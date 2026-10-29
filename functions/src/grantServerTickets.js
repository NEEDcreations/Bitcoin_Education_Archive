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
    const athleteKey = ticketGrants.stravaAthleteKey(opts && opts.athleteId);
    if (action === 'strava_connect_ticket' && !athleteKey) return { tickets: 0 };

    const preview = spec.dailyTickets
        ? ticketGrants.planRaidTickets(opts && opts.damage != null ? opts.damage : (opts && opts.tickets), 0)
        : ticketGrants.amountFor(action, opts && opts.tickets);
    if (!(preview > 0)) return { tickets: 0 };

    const day = ticketGrants.offsetDay();
    const userRef = db().collection('users').doc(uid);
    const countRef = (spec.maxGrants || spec.dailyTickets)
        ? userRef.collection('daily_action_counts').doc(day + '_' + action)
        : null;
    const athleteRef = athleteKey
        ? db().collection('strava_ticket_athletes').doc(athleteKey)
        : null;

    try {
        return await db().runTransaction(async (t) => {
            const userDoc = await t.get(userRef);
            const countDoc = countRef ? await t.get(countRef) : null;
            const athleteDoc = athleteRef ? await t.get(athleteRef) : null;
            if (!userDoc.exists) return { tickets: 0 };
            const user = userDoc.data() || {};
            if (user.ban_reason) return { tickets: 0 };
            if (user.lock && user.lock.state === 'locked') return { tickets: 0 };

            const countData = countDoc && countDoc.exists ? countDoc.data() : {};
            const used = countData.count || 0;
            if (spec.maxGrants && used >= spec.maxGrants) return { tickets: 0 };

            let tickets = preview;
            if (spec.dailyTickets) {
                tickets = ticketGrants.planRaidTickets(
                    opts && opts.damage != null ? opts.damage : (opts && opts.tickets),
                    countData.tickets || 0
                );
                if (!(tickets > 0)) return { tickets: 0 };
            }
            const claimId = ticketGrants.claimId(action, day, (spec.maxGrants || spec.dailyTickets) ? used + 1 : null);
            const claimRef = userRef.collection('award_claims').doc(claimId);
            const claimDoc = await t.get(claimRef);
            if (action === 'strava_connect_ticket') {
                if (!ticketGrants.stravaTicketAllowed(!!(athleteDoc && athleteDoc.exists), claimDoc.exists, athleteKey)) {
                    return { tickets: 0 };
                }
            } else if (claimDoc.exists) {
                return { tickets: 0 };
            }

            if (countRef) {
                const countWrite = {
                    count: used + 1,
                    lastAt: admin.firestore.FieldValue.serverTimestamp(),
                };
                if (spec.dailyTickets) countWrite.tickets = (countData.tickets || 0) + tickets;
                t.set(countRef, countWrite, { merge: true });
            }
            if (athleteRef) {
                t.set(athleteRef, {
                    uid: uid,
                    athleteId: athleteKey,
                    at: admin.firestore.FieldValue.serverTimestamp(),
                });
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
