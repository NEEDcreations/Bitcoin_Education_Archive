'use strict';

// Display-only stamp on notifications/{id}.resolved.
// Cloud Functions write it with the Admin SDK. Clients cannot: the
// notifications update rule allows `read` and nothing else.
// Rewards, tickets, keys, and peer membership must never read this field.

const STATES = {
    accepted: 'accepted',
    declined: 'declined',
    opened: 'opened',
    expired: 'expired',
    claimed: 'claimed',
    joined: 'joined',
    matched: 'matched',
    sold: 'sold',
    read: 'read',
};

function validId(id) {
    return typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id);
}

function resolvedPatch(state, timestamp) {
    if (!STATES[state]) return null;
    return {
        resolved: STATES[state],
        read: true,
        resolvedAt: timestamp,
    };
}

// docs: [{ id, data }]. filter may set type, recipientId, giftId, fromUid, targetId.
// A notice that already has this exact resolved value is skipped.
function pickNotifs(docs, filter) {
    const spec = filter || {};
    const out = [];
    (docs || []).forEach(function(doc) {
        if (!doc || !validId(doc.id)) return;
        const data = doc.data || {};
        if (spec.type && data.type !== spec.type && data.targetType !== spec.type) return;
        if (spec.recipientId && data.recipientId !== spec.recipientId) return;
        if (spec.giftId && data.giftId !== spec.giftId) return;
        if (spec.fromUid && data.fromUid !== spec.fromUid) return;
        if (spec.targetId && data.targetId !== spec.targetId) return;
        if (spec.state && data.resolved === spec.state) return;
        out.push(doc.id);
    });
    return out;
}

function keysStillOpen(docs) {
    return (docs || []).some(function(doc) {
        if (!doc) return false;
        const exists = doc.exists !== false && doc.data;
        if (!exists) return false;
        const status = doc.data.status || '';
        return status === 'inventory' || status === 'sent';
    });
}

async function writeResolved(db, ids, state, timestamp) {
    const patch = resolvedPatch(state, timestamp);
    if (!patch || !db || typeof db.collection !== 'function') return [];
    const seen = {};
    const unique = [];
    (ids || []).forEach(function(id) {
        if (!validId(id) || seen[id]) return;
        seen[id] = true;
        unique.push(id);
    });
    await Promise.all(unique.map(function(id) {
        return db.collection('notifications').doc(id).update(patch).catch(function() {});
    }));
    return unique;
}

// Best-effort. A missing index or a deleted notice must not fail the action
// that already committed (accept, open, claim).
async function stampMatching(db, spec) {
    const opts = spec || {};
    const ids = [];
    if (validId(opts.notifId)) ids.push(opts.notifId);
    if (opts.whereField && opts.whereValue != null && opts.whereValue !== '' && db && typeof db.collection === 'function') {
        try {
            const snap = await db.collection('notifications').where(opts.whereField, '==', opts.whereValue).limit(opts.limit || 20).get();
            const docs = (snap && snap.docs ? snap.docs : []).map(function(d) {
                return { id: d.id, data: (d.data && d.data()) || {} };
            });
            pickNotifs(docs, opts.filter || {}).forEach(function(id) { ids.push(id); });
        } catch (err) {
            console.warn('[notifResolved] lookup failed');
        }
    }
    return writeResolved(db, ids, opts.state, opts.timestamp);
}

// Mark key-gift notices claimed only when every key on the notice is used.
// A notice that still has an inventory or sent key stays actionable.
async function stampConsumedKey(db, keyId, timestamp) {
    if (!validId(keyId) || !db) return [];
    let snap;
    try {
        snap = await db.collection('notifications').where('keyIds', 'array-contains', keyId).limit(10).get();
    } catch (err) {
        console.warn('[notifResolved] key lookup failed');
        return [];
    }
    const docs = (snap && snap.docs) ? snap.docs : [];
    const claimed = [];
    for (let i = 0; i < docs.length; i++) {
        const data = (docs[i].data && docs[i].data()) || {};
        const keyIds = Array.isArray(data.keyIds) ? data.keyIds.filter(validId) : [];
        if (!keyIds.length) continue;
        if (data.resolved === 'claimed') continue;
        let open = false;
        try {
            const refs = keyIds.map(function(id) { return db.collection('keys').doc(id); });
            const keyDocs = typeof db.getAll === 'function' ? await db.getAll.apply(db, refs) : [];
            open = keysStillOpen(keyDocs.map(function(d) {
                return { exists: !!(d && d.exists), data: d && d.exists && d.data ? (d.data() || {}) : null };
            }));
        } catch (err) {
            continue;
        }
        if (!open && validId(docs[i].id)) claimed.push(docs[i].id);
    }
    return writeResolved(db, claimed, 'claimed', timestamp);
}

module.exports = {
    STATES: STATES,
    validId: validId,
    resolvedPatch: resolvedPatch,
    pickNotifs: pickNotifs,
    keysStillOpen: keysStillOpen,
    writeResolved: writeResolved,
    stampMatching: stampMatching,
    stampConsumedKey: stampConsumedKey,
};
