'use strict';

// One scheduled pass. Opted-in players live in reset_reminder_subs/{uid}.
// The user doc is the source of truth for switches, quiet hours, bans, and
// the faucet clock. A claim doc is written before the notice and the push,
// so a retry of the same reset does not send twice. A failed write deletes
// the claim so the next pass inside the lead window can try again.

const logic = require('./resetReminders');

function claimDoc(db, id) {
    return db.collection('reset_reminder_claims').doc(id);
}

async function claimOnce(db, id, nowMs) {
    const ref = claimDoc(db, id);
    return db.runTransaction(async function (tx) {
        const snap = await tx.get(ref);
        if (snap.exists) return false;
        tx.set(ref, { at: nowMs });
        return true;
    });
}

async function writeNotice(db, admin, uid, hit, id) {
    await db.collection('notifications').doc(id).set({
        recipientId: uid,
        type: 'reset_reminder',
        icon: '⏰',
        message: hit.title + '. ' + hit.body,
        targetType: 'chat',
        targetId: hit.id.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64),
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

async function listPage(db, admin, cursor) {
    let q = db.collection('reset_reminder_subs').orderBy(admin.firestore.FieldPath.documentId()).limit(200);
    if (cursor) q = q.startAfter(cursor);
    return q.get();
}

async function runDispatch(db, admin, sendPush, nowMs) {
    const now = nowMs || Date.now();
    const summary = { scanned: 0, sent: 0, skipped: 0, failed: 0 };
    let cursor = null;
    while (true) {
        const snap = await listPage(db, admin, cursor);
        if (!snap || snap.empty) break;
        for (let i = 0; i < snap.docs.length; i++) {
            const sub = snap.docs[i];
            const uid = sub.id;
            if (!/^[A-Za-z0-9_-]{4,128}$/.test(uid)) continue;
            summary.scanned++;
            let userSnap;
            try {
                userSnap = await db.collection('users').doc(uid).get();
            } catch (e) {
                summary.failed++;
                continue;
            }
            if (!userSnap.exists) {
                try {
                    await sub.ref.delete();
                    summary.dropped = (summary.dropped || 0) + 1;
                } catch (dropMissing) {
                    summary.failed++;
                }
                continue;
            }
            const user = userSnap.data() || {};
            if (user.anonymous === true || user.isAnonymous === true) {
                try {
                    await sub.ref.delete();
                    summary.dropped = (summary.dropped || 0) + 1;
                } catch (dropAnon) {
                    summary.failed++;
                }
                continue;
            }
            const hits = logic.planSends([{
                uid: uid,
                banned: user.banned === true,
                anonymous: user.anonymous === true,
                isAnonymous: user.isAnonymous === true,
                resetReminders: user.resetReminders,
                lastSatsClaim: user.lastSatsClaim
            }], now, {});
            for (let h = 0; h < hits.length; h++) {
                const row = hits[h];
                let claimed = false;
                try {
                    claimed = await claimOnce(db, row.id, now);
                } catch (e) {
                    summary.failed++;
                    continue;
                }
                if (!claimed) {
                    summary.skipped++;
                    continue;
                }
                try {
                    await writeNotice(db, admin, uid, row.hit, row.id);
                    if (typeof sendPush === 'function') {
                        await sendPush(uid, 'reminders', {
                            title: row.hit.title,
                            body: row.hit.body,
                            url: row.hit.url,
                            type: 'reset_reminder'
                        }, {
                            rateCategory: 'reset-reminders',
                            rateMax: 12,
                            rateWindowMs: 60 * 60 * 1000
                        });
                    }
                    summary.sent++;
                } catch (e) {
                    summary.failed++;
                    try { await claimDoc(db, row.id).delete(); } catch (drop) { /* next pass */ }
                }
            }
        }
        cursor = snap.docs[snap.docs.length - 1];
        if (snap.size < 200) break;
    }
    return summary;
}

module.exports = {
    runDispatch: runDispatch,
    claimOnce: claimOnce,
    writeNotice: writeNotice
};
