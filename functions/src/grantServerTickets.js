'use strict';

const admin = require('firebase-admin');
const ticketGrants = require('./ticketGrants');
const rewardNotify = require('./rewardNotify');

function db() {
    return admin.firestore();
}

// One claim document per grant. A second call for the same day (or the same
// Strava connect, or the same raid slot) writes nothing.
async function grantServerTickets(uid, action, opts) {
    const spec = ticketGrants.get(action);
    if (!spec || !uid || uid === 'unknown' || uid === 'nacho-bot' || uid === 'system') {
        return { tickets: 0 };
    }
    const tickets = ticketGrants.amountFor(action, opts && opts.tickets);
    if (!(tickets > 0)) return { tickets: 0 };

    const day = ticketGrants.offsetDay();
    const userRef = db().collection('users').doc(uid);
    const countRef = spec.maxGrants
        ? userRef.collection('daily_action_counts').doc(day + '_' + action)
        : null;

    try {
        return await db().runTransaction(async (t) => {
            const userDoc = await t.get(userRef);
            const countDoc = countRef ? await t.get(countRef) : null;
            if (!userDoc.exists) return { tickets: 0 };
            const user = userDoc.data() || {};
            if (user.ban_reason) return { tickets: 0 };

            const used = countDoc && countDoc.exists ? (countDoc.data().count || 0) : 0;
            if (spec.maxGrants && used >= spec.maxGrants) return { tickets: 0 };

            const claimId = ticketGrants.claimId(action, day, spec.maxGrants ? used + 1 : null);
            const claimRef = userRef.collection('award_claims').doc(claimId);
            const claimDoc = await t.get(claimRef);
            if (claimDoc.exists) return { tickets: 0 };

            if (countRef) {
                t.set(countRef, {
                    count: used + 1,
                    lastAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
            t.set(claimRef, {
                action: action,
                tickets: tickets,
                day: day,
                at: admin.firestore.FieldValue.serverTimestamp(),
            });
            t.update(userRef, {
                orangeTickets: admin.firestore.FieldValue.increment(tickets),
            });
            try {
                rewardNotify.apply(t, db(), admin.firestore.FieldValue.serverTimestamp(), rewardNotify.plan({
                    uid: uid,
                    tickets: tickets,
                    onceKey: claimId,
                    day: day,
                    sourceLabel: spec.label,
                    icon: '🎫',
                }));
            } catch (notifyErr) {
                console.warn('[tickets] notify skipped:', notifyErr && notifyErr.message);
            }
            return { tickets: tickets };
        });
    } catch (e) {
        console.warn('[tickets]', action, e && e.message);
        return { tickets: 0 };
    }
}

async function claimNachoChat(uid, text) {
    const clean = String(text || '').trim();
    if (clean.length < 1 || clean.length > 280) return { tickets: 0 };
    return grantServerTickets(uid, 'nacho_chat_ticket');
}

module.exports = {
    grantServerTickets: grantServerTickets,
    claimNachoChat: claimNachoChat,
};
