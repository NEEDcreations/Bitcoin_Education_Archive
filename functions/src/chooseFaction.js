'use strict';

// First faction choice. The client is hostile: the faction id is checked here,
// the user doc is re-read inside one transaction, and only this user's untagged
// Satoshi's Favor contributions move. A second call finds factionSyncs/users/{uid}
// and does nothing.

const { isSatsBanned } = require('./cipherClaim');

const FACTION_IDS = { cyber_hornets: true, honey_badgers: true };

const POINT_VALUES = {
    daily_all_three: 1,
    level_up: 1,
    level_up_5: 5,
    level_up_10: 10,
    badge_earned: 1,
};

function rewardsBlocked(user, ledger) {
    const u = user || {};
    const l = ledger || {};
    if (u.rewardBlocked === true || l.rewardBlocked === true) return true;
    if (u.banned === true) return true;
    if (u.ban_reason) return true;
    return isSatsBanned(u, l);
}

function docPoints(d) {
    const src = d || {};
    const raw = src.pointsAdded;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
    const mapped = POINT_VALUES[src.source];
    if (mapped) return mapped;
    return 1;
}

function requestedFaction(data) {
    const body = data || {};
    const raw = typeof body.faction === 'string' ? body.faction : (typeof body.newFaction === 'string' ? body.newFaction : '');
    return String(raw || '').trim();
}

function createChooseFactionHandlers(deps) {
    const options = deps || {};
    const db = options.db;
    const admin = options.admin;
    const HttpsError = options.HttpsError || function (code, message) {
        const err = new Error(message);
        err.code = code;
        return err;
    };

    function stamp() {
        if (admin && admin.firestore && admin.firestore.FieldValue && admin.firestore.FieldValue.serverTimestamp) {
            return admin.firestore.FieldValue.serverTimestamp();
        }
        return new Date();
    }

    async function chooseFaction(data, context) {
        if (!context || !context.auth || !context.auth.uid) {
            throw new HttpsError('unauthenticated', 'Must be signed in.');
        }
        const token = context.auth.token || {};
        const firebaseToken = token.firebase || {};
        if (firebaseToken.sign_in_provider === 'anonymous') {
            throw new HttpsError('permission-denied', 'Account required.');
        }
        const faction = requestedFaction(data);
        if (!FACTION_IDS[faction]) {
            throw new HttpsError('invalid-argument', 'Invalid faction.');
        }

        const uid = context.auth.uid;
        const userRef = db.collection('users').doc(uid);
        const ledgerRef = db.collection('faucet_ledger').doc(uid);
        const totalsRef = db.collection('satoshiFavor').doc('factionTotals');
        const syncRef = db.collection('satoshiFavor').doc('factionSyncs').collection('users').doc(uid);
        const contributorsQuery = db.collection('satoshiFavor').doc('current').collection('contributors').where('uid', '==', uid);

        const outcome = { moved: 0 };
        await db.runTransaction(async function (t) {
            const userSnap = await t.get(userRef);
            const ledgerSnap = await t.get(ledgerRef);
            const syncSnap = await t.get(syncRef);
            const totalsSnap = await t.get(totalsRef);
            const contribSnap = await t.get(contributorsQuery);

            if (!userSnap.exists) {
                throw new HttpsError('not-found', 'Account not found.');
            }
            const user = userSnap.data() || {};
            const ledger = ledgerSnap && ledgerSnap.exists ? (ledgerSnap.data() || {}) : {};
            if (rewardsBlocked(user, ledger)) {
                throw new HttpsError('permission-denied', 'Rewards are disabled on this account.');
            }
            const already = user.faction && String(user.faction).trim();
            if ((syncSnap && syncSnap.exists) || already) {
                throw new HttpsError('failed-precondition', 'You already chose a faction.');
            }

            let sum = 0;
            const untagged = [];
            const each = contribSnap && typeof contribSnap.forEach === 'function'
                ? contribSnap.forEach.bind(contribSnap)
                : function (fn) { (contribSnap && contribSnap.docs ? contribSnap.docs : []).forEach(fn); };
            each(function (doc) {
                const row = doc.data() || {};
                if (row.uid && row.uid !== uid) return;
                if (row.faction) return;
                sum += docPoints(row);
                untagged.push(doc.ref);
            });

            const totals = totalsSnap && totalsSnap.exists ? (totalsSnap.data() || {}) : {};
            const poolRaw = Number(totals.unaffiliated || 0);
            const pool = Number.isFinite(poolRaw) && poolRaw > 0 ? poolRaw : 0;
            const moved = Math.min(sum, pool);
            const prevRaw = Number(totals[faction] || 0);
            const prev = Number.isFinite(prevRaw) && prevRaw > 0 ? prevRaw : 0;

            t.set(userRef, { faction: faction }, { merge: true });
            t.set(totalsRef, {
                unaffiliated: pool - moved,
                [faction]: prev + moved,
                lastUpdated: stamp(),
            }, { merge: true });
            untagged.forEach(function (ref) {
                t.update(ref, { faction: faction });
            });
            t.create(syncRef, {
                uid: uid,
                faction: faction,
                pointsSynced: moved,
                syncedAt: stamp(),
            });
            outcome.moved = moved;
        });

        try { await require('./badgeCredit').grantIds(db, admin, uid, ['faction_chosen']); }
        catch (e) { console.warn('[chooseFaction] badge', e && e.message); }
        return { success: true, moved: outcome.moved, pointsSynced: outcome.moved };
    }

    return { chooseFaction: chooseFaction, rewardsBlocked: rewardsBlocked, docPoints: docPoints };
}

function bindChooseFaction(functionsV1, deps) {
    const handlers = createChooseFactionHandlers(Object.assign({
        HttpsError: functionsV1.https.HttpsError,
    }, deps || {}));
    const opts = { enforceAppCheck: true, timeoutSeconds: 60 };
    // Same handler and the same guards. The old name stays callable for clients
    // that have not picked up chooseFaction yet.
    return {
        chooseFaction: functionsV1.runWith(opts).https.onCall(handlers.chooseFaction),
        syncUserFactionPoints: functionsV1.runWith(opts).https.onCall(handlers.chooseFaction),
    };
}

module.exports = {
    createChooseFactionHandlers: createChooseFactionHandlers,
    bindChooseFaction: bindChooseFaction,
    rewardsBlocked: rewardsBlocked,
    docPoints: docPoints,
};
