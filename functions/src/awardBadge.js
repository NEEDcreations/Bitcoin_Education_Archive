'use strict';

// One transaction per badge: prove it, write the award, and add one
// Satoshi's Favor point. A second award of the same id does not add a second point.
// The daily XP cap still writes the badge and the Favor point, with 0 XP.

const { splitDailyXp } = require('./dailyXp');
const badgeRules = require('./badgeRules');
const { rewardBlocked } = require('./cipherClaim');
const { planFavorPoint } = require('./favorPool');
const { offsetDateKey } = require('./offsetDay');

const BADGE_DAILY_CAP = 1000;
const ALIASES = { country_set: 'global_citizen' };

function cleanId(raw) {
    const trimmed = String(raw || '').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 60);
    return ALIASES[trimmed] || trimmed;
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

async function awardBadge(db, adminSdk, uid, rawBadgeId, opts) {
    const options = opts || {};
    const badgeId = cleanId(rawBadgeId);
    const rule = badgeRules.ruleFor(badgeId);
    if (!rule) return { granted: false, success: false, reason: 'unknown', awarded: 0, xp: 0 };
    const verified = options.verified === true;
    if (rule.cosmetic && !verified) {
        return { granted: false, success: true, cosmetic: true, reason: 'cosmetic', awarded: 0, xp: 0, badgeId: badgeId };
    }

    const userRef = db.collection('users').doc(uid);
    const awardRef = userRef.collection('badge_awards').doc(badgeId);
    const nowMs = Number(options.nowMs) || Date.now();
    const day = options.day || offsetDateKey(nowMs);
    const dailyRef = userRef.collection('daily_points').doc(day);
    const ledgerRef = db.collection('faucet_ledger').doc(uid);
    const stateRef = db.collection('satoshiFavor').doc('current');
    const contributorRef = stateRef.collection('contributors').doc(uid + '_badge_' + badgeId);
    const totalsRef = db.collection('satoshiFavor').doc('factionTotals');
    const needsAwards = !verified && rule.source && (rule.source.type === 'awards' || rule.source.type === 'set');

    return db.runTransaction(async function (t) {
        const reads = [
            t.get(userRef),
            t.get(awardRef),
            t.get(dailyRef),
            t.get(ledgerRef),
            t.get(stateRef),
            t.get(contributorRef),
            t.get(totalsRef),
        ];
        if (needsAwards) reads.push(t.get(userRef.collection('badge_awards')));
        const snaps = await Promise.all(reads);
        const userSnap = snaps[0];
        const awardSnap = snaps[1];
        const dailySnap = snaps[2];
        const ledgerSnap = snaps[3];
        const stateSnap = snaps[4];
        const contributorSnap = snaps[5];
        const totalsSnap = snaps[6];
        const awardsSnap = snaps[7];

        if (!userSnap.exists) return { granted: false, success: false, reason: 'no_user', awarded: 0, xp: 0, badgeId: badgeId };
        const user = userSnap.data() || {};
        const ledger = ledgerSnap && ledgerSnap.exists ? (ledgerSnap.data() || {}) : {};
        if (rewardBlocked(user, ledger)) {
            return { granted: false, success: true, reason: 'banned', awarded: 0, xp: 0, badgeId: badgeId };
        }
        if (awardSnap.exists) {
            return { granted: false, success: false, reason: 'already', awarded: 0, xp: 0, favor: false, badgeId: badgeId };
        }

        const awardSet = new Set();
        if (awardsSnap && typeof awardsSnap.forEach === 'function') {
            awardsSnap.forEach(function (doc) { awardSet.add(doc.id); });
        }
        const payingCount = badgeRules.countPaying(awardSet);
        const signedIn = options.signedIn !== false;
        if (!verified && !badgeRules.meets(rule, user, { awardSet: awardSet, payingCount: payingCount, signedIn: signedIn })) {
            return { granted: false, success: false, reason: 'criteria', awarded: 0, xp: 0, badgeId: badgeId };
        }

        const catalogXp = Math.min(
            badgeRules.XP_CAP,
            verified && rule.cosmetic ? (Number(rule.displayXp) || 0) : (Number(rule.xp) || 0)
        );
        const dailyUsed = dailySnap.exists ? Number((dailySnap.data() || {}).total || 0) : 0;
        const split = splitDailyXp(dailyUsed, catalogXp, BADGE_DAILY_CAP);
        const xp = split.awarded > 0 ? split.awarded : 0;

        const update = {
            visibleBadges: adminSdk.firestore.FieldValue.arrayUnion(badgeId),
        };
        if (!rule.cosmetic && rule.xp > 0) update.payingBadgeCount = adminSdk.firestore.FieldValue.increment(1);
        if (xp > 0) {
            update.points = adminSdk.firestore.FieldValue.increment(xp);
            update.weeklyXP = adminSdk.firestore.FieldValue.increment(xp);
            update.monthlyXP = adminSdk.firestore.FieldValue.increment(xp);
        }
        t.set(awardRef, {
            awardedAt: adminSdk.firestore.FieldValue.serverTimestamp(),
            badge: badgeId,
            xp: xp,
            requestedXp: catalogXp,
            day: day,
            source: options.source || 'awardBadge',
        });
        t.update(userRef, update);
        if (xp > 0) {
            t.set(dailyRef, {
                total: dailyUsed + xp,
                lastUpdated: adminSdk.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }

        let favor = false;
        if (!contributorSnap.exists) {
            const stateData = stateSnap.exists ? (stateSnap.data() || {}) : {
                points: 0, favorActive: false, bonusMinutes: 0, eraHashes: 0,
            };
            const plan = planFavorPoint(stateData, nowMs);
            const faction = user.faction || null;
            t.set(contributorRef, {
                uid: uid,
                source: 'badge_earned',
                detail: badgeId,
                badgeId: badgeId,
                day: day,
                timestamp: adminSdk.firestore.FieldValue.serverTimestamp(),
                faction: faction,
                pointsAdded: 1,
            });
            const field = factionField(faction);
            const totals = totalsSnap.exists ? (totalsSnap.data() || {}) : {};
            const totalsWrite = { lastUpdated: adminSdk.firestore.FieldValue.serverTimestamp() };
            totalsWrite[field] = (Number(totals[field]) || 0) + 1;
            t.set(totalsRef, Object.assign({}, totals, totalsWrite));
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
            t.set(stateRef, next);
            favor = true;
        }

        return {
            granted: true,
            success: true,
            xp: xp,
            awarded: xp,
            overflowAdded: split.overflowAdded,
            capped: catalogXp > 0 && xp <= 0,
            favor: favor,
            badgeId: badgeId,
            cosmetic: false,
        };
    });
}

module.exports = {
    awardBadge: awardBadge,
    cleanId: cleanId,
    BADGE_DAILY_CAP: BADGE_DAILY_CAP,
};
