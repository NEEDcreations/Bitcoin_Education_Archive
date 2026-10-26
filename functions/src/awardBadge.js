'use strict';

// One transaction per badge: prove it, write the award, and add one
// Satoshi's Favor point. A second award of the same id does not add a second point.
// Badge XP goes through applyDailyXp: full until 500, half until 900, quarter until 1,000, then 0.
// The remainder is dropped. Nothing is saved for a later day.
// A badge the profile already shows gets an award row with 0 XP and no pool point.
// Its Favor credit is the backfill's job. Already-owned badges do not read the pool.

const { applyDailyXp } = require('./applyDailyXp');
const badgeRules = require('./badgeRules');
const { rewardBlocked } = require('./cipherClaim');
const { planFavorPoint } = require('./favorPool');
const { offsetDateKey } = require('./offsetDay');
const { profileHoldsBadge } = require('./badgeProfile');

const ALIASES = { country_set: 'global_citizen' };

function needsFlexClaims(rule) {
    if (!rule || !rule.source) return false;
    const kind = rule.source.type;
    return kind === 'flex' || kind === 'flexSum' || kind === 'flexAll';
}

function claimIdsFromSnap(snap) {
    const ids = [];
    if (!snap) return ids;
    if (typeof snap.forEach === 'function') {
        snap.forEach(function (doc) { ids.push(doc.id); });
        return ids;
    }
    (snap.docs || []).forEach(function (doc) { ids.push(doc.id); });
    return ids;
}

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

function legacyAward(adminSdk, badgeId, day) {
    return {
        awardedAt: adminSdk.firestore.FieldValue.serverTimestamp(),
        badge: badgeId,
        xp: 0,
        requestedXp: 0,
        day: day,
        source: 'legacy',
    };
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
    const ledgerRef = db.collection('faucet_ledger').doc(uid);
    const stateRef = db.collection('satoshiFavor').doc('current');
    const contributorRef = stateRef.collection('contributors').doc(uid + '_badge_' + badgeId);
    const totalsRef = db.collection('satoshiFavor').doc('factionTotals');
    const needsAwards = !verified && rule.source && (rule.source.type === 'awards' || rule.source.type === 'set');

    const result = await db.runTransaction(async function (t) {
        // Recomputed on every attempt. A retry must not reuse a clock from before the transaction.
        const nowMs = Number(options.nowMs) || Date.now();
        const day = options.day || offsetDateKey(nowMs);
        const userSnap = await t.get(userRef);
        const awardSnap = await t.get(awardRef);
        const ledgerSnap = await t.get(ledgerRef);

        if (!userSnap.exists) return { granted: false, success: false, reason: 'no_user', awarded: 0, xp: 0, badgeId: badgeId };
        const user = userSnap.data() || {};
        const ledger = ledgerSnap && ledgerSnap.exists ? (ledgerSnap.data() || {}) : {};
        if (rewardBlocked(user, ledger)) {
            return { granted: false, success: true, reason: 'banned', awarded: 0, xp: 0, badgeId: badgeId };
        }
        if (awardSnap.exists) {
            return { granted: false, success: false, reason: 'already', awarded: 0, xp: 0, favor: false, badgeId: badgeId };
        }
        if (profileHoldsBadge(user, badgeId)) {
            t.set(awardRef, legacyAward(adminSdk, badgeId, day));
            return {
                granted: false,
                success: true,
                legacy: true,
                reason: 'legacy',
                awarded: 0,
                xp: 0,
                favor: false,
                badgeId: badgeId,
            };
        }
        // Old set bonuses stay on profiles that already have them. New grants
        // are the merged collection bonus, which pays the remainder itself.
        if (require('./collectionBonus').isRetiredSetBonus(badgeId)) {
            return { granted: false, success: false, reason: 'retired', awarded: 0, xp: 0, favor: false, badgeId: badgeId };
        }

        // flexClaims is the server tally of daily_action_counts, computed
        // outside this transaction. The award doc and the user doc are read
        // again here, and meets() still has to pass before any write. A
        // passed tally skips the full subcollection scan. Nothing here is
        // taken from the client.
        let flexClaims = options.flexClaims || null;
        if (!flexClaims && needsFlexClaims(rule)) {
            const countsSnap = await t.get(userRef.collection('daily_action_counts'));
            flexClaims = badgeRules.tallyFlexClaims(claimIdsFromSnap(countsSnap));
        }
        let awardsSnap = null;
        if (needsAwards) awardsSnap = await t.get(userRef.collection('badge_awards'));
        const awardSet = new Set();
        if (awardsSnap && typeof awardsSnap.forEach === 'function') {
            awardsSnap.forEach(function (doc) { awardSet.add(doc.id); });
        }
        let scholarExamPassed = false;
        if (!verified && rule.source && rule.source.type === 'scholarExam') {
            const examType = rule.source.examType || 'properties';
            const priorSnap = await t.get(db.collection('scholar_exam_keys').where('uid', '==', uid));
            scholarExamPassed = !!require('./scholarExam').passedExam(priorSnap, examType, null);
        }
        const payingCount = badgeRules.countPaying(awardSet);
        const signedIn = options.signedIn !== false;
        if (!verified && !badgeRules.meets(rule, user, { awardSet: awardSet, payingCount: payingCount, signedIn: signedIn, flexClaims: flexClaims, scholarExamPassed: scholarExamPassed })) {
            return { granted: false, success: false, reason: 'criteria', awarded: 0, xp: 0, badgeId: badgeId };
        }

        const stateSnap = await t.get(stateRef);
        const contributorSnap = await t.get(contributorRef);
        const totalsSnap = await t.get(totalsRef);

        const catalogXp = verified && rule.cosmetic ? (Number(rule.displayXp) || 0) : (Number(rule.xp) || 0);
        const xpGrant = await applyDailyXp(uid, catalogXp, t, { day: day, userRef: userRef });
        const xp = xpGrant.awarded > 0 ? xpGrant.awarded : 0;

        const update = {
            visibleBadges: adminSdk.firestore.FieldValue.arrayUnion(badgeId),
        };
        if (!rule.cosmetic && rule.xp > 0) update.payingBadgeCount = adminSdk.firestore.FieldValue.increment(1);
        if (xp > 0) {
            update.points = adminSdk.firestore.FieldValue.increment(xp);
            update.weeklyXP = adminSdk.firestore.FieldValue.increment(xp);
            update.monthlyXP = adminSdk.firestore.FieldValue.increment(xp);
        }
        const awardDoc = {
            awardedAt: adminSdk.firestore.FieldValue.serverTimestamp(),
            badge: badgeId,
            xp: xp,
            requestedXp: catalogXp,
            dropped: xpGrant.dropped,
            day: day,
            source: options.source || 'awardBadge',
            favorPoint: false,
        };
        if (options.xpSource) awardDoc.xpSource = String(options.xpSource);
        if (options.backfill === true) awardDoc.backfill = true;
        if (options.ggSkip === true) awardDoc.ggSkip = true;
        t.update(userRef, update);
        if (xp > 0 && xpGrant.dailyRef) {
            t.set(xpGrant.dailyRef, {
                total: xpGrant.dailyXp,
                lastUpdated: adminSdk.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }

        let favor = false;
        let favorPoint = false;
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
                // A badge that lands in the minute before the cron must start a
                // new contributor window, or the next LIVE post counts the last one.
                next.lastReset = stamp(adminSdk, nowMs);
            }
            if (plan.expired) {
                t.set(db.collection('satoshiFavor').doc('lastWindow'), {
                    cycleId: stateData.currentCycleId || null,
                    endedAt: stamp(adminSdk, nowMs),
                    archivedAt: stamp(adminSdk, nowMs),
                });
            }
            t.set(stateRef, next);
            const userSfRef = db.collection('satoshiFavor').doc('userSfPoints').collection('users').doc(uid);
            t.set(userSfRef, {
                uid: uid,
                points: adminSdk.firestore.FieldValue.increment(1),
                updatedAt: adminSdk.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            favor = true;
            // Pool points only. An open window adds bonus minutes and does not increment the pool.
            favorPoint = plan.extended !== true;
            awardDoc.favorPoint = favorPoint;
        }
        t.set(awardRef, awardDoc);

        return {
            granted: true,
            success: true,
            xp: xp,
            awarded: xp,
            overflowAdded: 0,
            dropped: xpGrant.dropped,
            capped: xpGrant.capped,
            capBypass: false,
            favor: favor,
            favorPoint: favorPoint,
            badgeId: badgeId,
            cosmetic: false,
            nowMs: nowMs,
            day: day,
        };
    });
    if (result && result.granted && options.skipCollections !== true) {
        const hook = function () {
            return require('./collectionBonus').maybeGrantForBadge(db, adminSdk, uid, result.badgeId || badgeId, {
                day: result.day,
                nowMs: result.nowMs,
            });
        };
        try {
            await hook();
        } catch (err) {
            console.error('[collectionBonus]', err && err.message ? err.message : err);
            try { await hook(); }
            catch (err2) { console.error('[collectionBonus] retry', err2 && err2.message ? err2.message : err2); }
        }
    }
    return result;
}

module.exports = {
    awardBadge: awardBadge,
    cleanId: cleanId,
};
