'use strict';

// Server-side Nacho posts for a new PlebTalk thread or Marketplace listing.
// Reuses publishShoutoutOnce (global_chat, deterministic id) and
// mirrorShoutoutOnce (Telegram + reaction stamp). Clients never write these.

const {
    planActivityShoutout,
    activityLimitDocId,
} = require('./shoutout');
const { publishShoutoutOnce } = require('./shoutoutPublish');
const { mirrorShoutoutOnce } = require('./telegramBridge');

const ACTIVITY_GRACE_MS = 10000;

function delay(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

function sourceCollection(kind) {
    return kind === 'marketplace' ? 'marketplace' : 'forum_posts';
}

function authorUidOf(kind, data) {
    const src = data || {};
    return kind === 'marketplace' ? String(src.sellerUid || '') : String(src.authorId || '');
}

async function announceActivity(opts) {
    const o = opts || {};
    const kind = o.kind === 'marketplace' ? 'marketplace' : (o.kind === 'forum' ? 'forum' : '');
    const id = String(o.id || '');
    const db = o.db;
    if (!kind || !db || !o.admin) return { posted: false, reason: 'bad_kind' };
    const sleep = o.sleep || delay;
    const graceMs = typeof o.graceMs === 'number' ? o.graceMs : ACTIVITY_GRACE_MS;
    if (graceMs > 0) await sleep(graceMs);

    const freshSnap = await db.collection(sourceCollection(kind)).doc(id).get();
    if (!freshSnap.exists) return { posted: false, reason: 'deleted' };
    const fresh = freshSnap.data() || {};
    const uid = authorUidOf(kind, fresh);
    let user = {};
    let ledger = null;
    let addressLock = null;
    if (/^[A-Za-z0-9_-]{1,128}$/.test(uid)) {
        const userSnap = await db.collection('users').doc(uid).get();
        if (userSnap.exists) user = userSnap.data() || {};
        const ledgerSnap = await db.collection('faucet_ledger').doc(uid).get();
        if (ledgerSnap.exists) ledger = ledgerSnap.data() || {};
        const addr = String(user.lightningAddress || user.lightning || '').trim().toLowerCase();
        if (addr && addr.indexOf('/') === -1 && addr.length <= 300) {
            const lockSnap = await db.collection('lightning_addresses').doc(addr).get();
            if (lockSnap.exists) addressLock = lockSnap.data() || {};
        }
    }

    const plan = planActivityShoutout({
        kind: kind,
        id: id,
        uid: uid,
        item: fresh,
        user: user,
        ledger: ledger,
        addressLock: addressLock,
    });
    if (!plan.post) return { posted: false, reason: plan.reason };

    const published = await publishShoutoutOnce({
        db: db,
        admin: o.admin,
        plan: plan,
        claimRef: db.collection('shoutout_claims').doc(plan.docId),
        authorLimitRef: db.collection('shoutout_limits').doc(activityLimitDocId(kind, uid)),
        globalLimitRef: db.collection('shoutout_limits').doc('global'),
        nowMs: typeof o.nowMs === 'number' ? o.nowMs : Date.now(),
    });
    if (published && (published.wrote || published.reason === 'already_posted')) {
        const mirror = o.mirror || function(args) {
            return mirrorShoutoutOnce({
                db: db,
                docId: args.docId,
                collection: args.collection,
                text: args.text,
            });
        };
        await mirror({ docId: plan.docId, collection: plan.collection, text: plan.text });
    }
    return {
        posted: !!(published && published.wrote),
        reason: published ? published.reason : 'bad_plan',
        docId: plan.docId,
        text: plan.post ? plan.text : '',
    };
}

module.exports = {
    announceActivity: announceActivity,
    ACTIVITY_GRACE_MS: ACTIVITY_GRACE_MS,
};
