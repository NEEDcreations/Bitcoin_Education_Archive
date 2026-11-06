'use strict';

// Server counters for badge families whose old proof was a client claim.
// Each counter is written inside the callable that already accepted the
// action, and only when that callable's dedup doc is created.

const awardActions = require('./awardActions');
const { grantFamily, familyFor } = require('./grantBadge');

const LQ_BY_TARGET = {
    WhatisBitcoin: 'lq_what_is_bitcoin',
    MiningProofofWork: 'lq_mining',
    NodesDecentralization: 'lq_nodes',
    SelfCustodyYourKeys: 'lq_self_custody',
    TheLightningNetwork: 'lq_lightning',
    BitcoinsFixedSupply: 'lq_scarcity',
    WhyBitcoinNotCrypto: 'lq_bitcoin_only',
    PrivacySovereignty: 'lq_privacy',
};

function previousDay(day) {
    const ms = Date.parse(String(day || '') + 'T00:00:00Z');
    if (!Number.isFinite(ms)) return '';
    return new Date(ms - 86400000).toISOString().slice(0, 10);
}

function progressSpec(userData, matchedAction, resolved, day) {
    const user = userData || {};
    const action = resolved || {};
    if (matchedAction === 'flex_action' && action.flexId) {
        return {
            kind: 'flex',
            flexId: action.flexId,
            day: day,
            inc: { ['flexTotals.' + action.flexId]: 1 },
        };
    }
    if (matchedAction === 'trivia_correct') {
        const spec = {
            kind: 'trivia',
            day: day,
            inc: { triviaCorrect: 1 },
            set: { triviaStreakDay: day },
        };
        if ((user.triviaStreakDay || '') === previousDay(day)) spec.inc.triviaStreak = 1;
        else spec.set.triviaStreak = 1;
        return spec;
    }
    if (matchedAction === 'lq_lesson' && action.target && LQ_BY_TARGET[action.target]) {
        const badgeId = LQ_BY_TARGET[action.target];
        return { kind: 'lq', badgeId: badgeId, union: { lqPassed: badgeId } };
    }
    return null;
}

function applySpec(userUpdate, adminSdk, spec) {
    if (!spec || !userUpdate) return;
    const inc = spec.inc || {};
    Object.keys(inc).forEach(function (key) {
        userUpdate[key] = adminSdk.firestore.FieldValue.increment(inc[key]);
    });
    const set = spec.set || {};
    Object.keys(set).forEach(function (key) { userUpdate[key] = set[key]; });
    const union = spec.union || {};
    Object.keys(union).forEach(function (key) {
        userUpdate[key] = adminSdk.firestore.FieldValue.arrayUnion(union[key]);
    });
}

function flexBadgeIds(actionId) {
    const steps = [1, 5, 10, 25, 50, 100, 500, 1000];
    const ids = steps.map(function (n) { return 'flex_' + actionId + '_' + n; });
    return ids.concat([
        'flex_rookie', 'flex_committed', 'flex_athlete', 'flex_legend', 'flex_all_once',
        'flex_all_1', 'flex_all_5', 'flex_all_50', 'flex_all_500',
    ]);
}

async function noteFlexAll(db, adminSdk, uid, day) {
    const userRef = db.collection('users').doc(uid);
    const markerRef = userRef.collection('daily_action_counts').doc(day + '_flex_all');
    const ids = awardActions.FLEX_IDS;
    await db.runTransaction(async function (t) {
        const reads = [t.get(markerRef)];
        ids.forEach(function (id) {
            reads.push(t.get(userRef.collection('award_claims').doc(day + '_flex_' + id)));
        });
        const snaps = await Promise.all(reads);
        if (snaps[0].exists) return;
        for (let i = 1; i < snaps.length; i++) {
            if (!snaps[i].exists) return;
        }
        t.set(markerRef, { day: day });
        t.update(userRef, { flexAllDays: adminSdk.firestore.FieldValue.increment(1) });
    });
}

async function grantProgress(db, adminSdk, uid, spec) {
    if (!spec) return;
    if (spec.kind === 'flex') {
        if (spec.day) {
            try { await noteFlexAll(db, adminSdk, uid, spec.day); }
            catch (e) { console.warn('[flex] all-day tally', e && e.message); }
        }
        // grantFamily reads badge_awards once, skips ids already earned, tallies
        // daily_action_counts once outside a transaction, and opens awardBadge
        // only when that server tally meets the badge.
        await grantFamily(db, adminSdk, uid, flexBadgeIds(spec.flexId));
        return;
    }
    if (spec.kind === 'trivia') {
        await grantFamily(db, adminSdk, uid, familyFor('triviaCorrect').concat(familyFor('triviaStreak')));
        return;
    }
    if (spec.kind === 'lq') {
        await grantFamily(db, adminSdk, uid, familyFor('lqPassed'));
    }
}

module.exports = {
    previousDay: previousDay,
    progressSpec: progressSpec,
    applySpec: applySpec,
    noteFlexAll: noteFlexAll,
    grantProgress: grantProgress,
    LQ_BY_TARGET: LQ_BY_TARGET,
    flexBadgeIds: flexBadgeIds,
};
