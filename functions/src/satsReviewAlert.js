'use strict';

// In-app note for accounts that already hold the admin custom claim.
// Same notifications collection and shape as the daily faucet report.
// No email, Telegram, or other channel.

async function listAdminClaimUids(admin) {
    const uids = [];
    let pageToken;
    do {
        const page = await admin.auth().listUsers(1000, pageToken);
        page.users.forEach(function (user) {
            if (user.customClaims && user.customClaims.admin === true) uids.push(user.uid);
        });
        pageToken = page.pageToken;
    } while (pageToken);
    return uids;
}

async function notifyAdminClaim(db, admin, note) {
    const src = note || {};
    const uids = await listAdminClaimUids(admin);
    const base = String(src.docId || 'sats_review').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
    const message = String(src.message || '').slice(0, 180);
    for (let i = 0; i < uids.length; i++) {
        await db.collection('notifications').doc(base + '_' + uids[i]).set({
            recipientId: uids[i],
            senderId: 'system',
            senderName: 'Bitcoin Quest',
            type: 'security',
            message: message,
            targetType: 'faucet_abuse',
            targetId: String(src.targetId || '').slice(0, 40),
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    return uids.length;
}

module.exports = { listAdminClaimUids, notifyAdminClaim };
