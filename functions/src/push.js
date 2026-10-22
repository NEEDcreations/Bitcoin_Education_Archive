'use strict';

// Server-only FCM send path. Tokens are read with the Admin SDK.
// Every user-facing send goes through categoryAllowed before delivery.

const admin = require('firebase-admin');
const prefs = require('./pushPrefs');

const INVALID_TOKEN = {
    'messaging/invalid-registration-token': true,
    'messaging/registration-token-not-registered': true
};

const MAX_DEVICES = 10;
const PREP_CHUNK = 20;

function firestore() {
    return admin.firestore();
}

function isInvalidTokenError(err) {
    return !!(err && INVALID_TOKEN[err.code]);
}

function timestampMs(value) {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value === 'number' && isFinite(value)) return value;
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    return 0;
}

function dedupeTokens(entries) {
    const seen = {};
    const out = [];
    (entries || []).forEach(function (entry) {
        if (!entry || !entry.token) return;
        const token = String(entry.token);
        const row = {
            ref: entry.ref || null,
            token: token,
            legacy: entry.legacy === true,
            userField: entry.userField || '',
            updatedAtMs: entry.updatedAtMs || 0
        };
        if (seen[token]) {
            if (row.updatedAtMs > seen[token].updatedAtMs) {
                seen[token].updatedAtMs = row.updatedAtMs;
                if (row.ref) seen[token].ref = row.ref;
            }
            return;
        }
        seen[token] = row;
        out.push(row);
    });
    return out;
}

function deviceEntry(doc) {
    if (!doc.get('token')) return null;
    return {
        ref: doc.ref,
        token: doc.get('token'),
        updatedAtMs: timestampMs(doc.get('updatedAt'))
    };
}

async function loadUserTokens(uid) {
    const db = firestore();
    const userRef = db.collection('users').doc(uid);
    const parentRef = db.collection('push_tokens').doc(uid);
    const [userSnap, parentSnap, devicesSnap] = await Promise.all([
        userRef.get(),
        parentRef.get(),
        parentRef.collection('devices').get()
    ]);
    const userData = userSnap.exists ? (userSnap.data() || {}) : {};
    const entries = [];
    if (parentSnap.exists && parentSnap.get('token')) {
        entries.push({ ref: parentSnap.ref, token: parentSnap.get('token'), legacy: true });
    }
    devicesSnap.forEach(function (doc) {
        const entry = deviceEntry(doc);
        if (entry) entries.push(entry);
    });
    ['fcmToken', 'pushToken'].forEach(function (field) {
        if (userData[field]) entries.push({ ref: null, token: userData[field], userField: field });
    });
    return { userData: userData, tokens: dedupeTokens(entries) };
}

async function listTokenIndex() {
    const db = firestore();
    const parents = await db.collection('push_tokens').get();
    const byUid = new Map();
    for (let i = 0; i < parents.docs.length; i++) {
        const doc = parents.docs[i];
        const uid = doc.id;
        const entries = [];
        if (doc.get('token')) entries.push({ ref: doc.ref, token: doc.get('token'), legacy: true });
        const devices = await doc.ref.collection('devices').get();
        devices.forEach(function (child) {
            const entry = deviceEntry(child);
            if (entry) entries.push(entry);
        });
        byUid.set(uid, entries);
    }
    return byUid;
}

async function dropToken(uid, entry) {
    const db = firestore();
    if (entry.ref) {
        try { await entry.ref.delete(); } catch (e) { /* already gone */ }
    }
    if (entry.legacy) {
        try {
            await db.collection('push_tokens').doc(uid).set({
                token: admin.firestore.FieldValue.delete()
            }, { merge: true });
        } catch (e) { /* parent may be missing */ }
    }
    if (entry.userField === 'fcmToken' || entry.userField === 'pushToken') {
        const patch = {};
        patch[entry.userField] = admin.firestore.FieldValue.delete();
        try { await db.collection('users').doc(uid).update(patch); } catch (e) { /* user gone */ }
    }
}

function tokenParentUid(doc) {
    const userDoc = doc.ref.parent && doc.ref.parent.parent;
    const root = userDoc && userDoc.parent;
    if (!root || root.id !== 'push_tokens') return '';
    return userDoc.id;
}

// A token belongs to the user who registered it last. Older copies are dropped
// so a shared phone cannot keep delivering the previous account's pushes.
async function releaseTokenFromOthers(uid, token) {
    if (!token) return 0;
    const snap = await firestore().collectionGroup('devices').where('token', '==', String(token)).get();
    const batch = firestore().batch();
    let removed = 0;
    snap.forEach(function (doc) {
        const other = tokenParentUid(doc);
        if (!other || other === uid) return;
        batch.delete(doc.ref);
        removed++;
    });
    if (removed) await batch.commit();
    return removed;
}

async function capUserDevices(uid, keepDeviceId) {
    const snap = await firestore().collection('push_tokens').doc(uid).collection('devices')
        .orderBy('updatedAt', 'asc').get();
    if (snap.size <= MAX_DEVICES) return 0;
    let over = snap.size - MAX_DEVICES;
    const batch = firestore().batch();
    let removed = 0;
    snap.docs.forEach(function (doc) {
        if (over <= 0) return;
        if (keepDeviceId && doc.id === keepDeviceId) return;
        batch.delete(doc.ref);
        removed++;
        over--;
    });
    if (removed) await batch.commit();
    return removed;
}

async function dropForeignCopies(uid, tokens) {
    const kept = [];
    for (let i = 0; i < tokens.length; i++) {
        const entry = tokens[i];
        let foreignNewer = false;
        try {
            const snap = await firestore().collectionGroup('devices').where('token', '==', entry.token).limit(25).get();
            snap.forEach(function (doc) {
                const other = tokenParentUid(doc);
                if (!other || other === uid) return;
                if (timestampMs(doc.get('updatedAt')) >= (entry.updatedAtMs || 0)) foreignNewer = true;
            });
        } catch (e) {
            console.warn('[push] token owner lookup failed', e.message);
        }
        if (foreignNewer) {
            try { await dropToken(uid, entry); } catch (e) { /* next sweep */ }
            continue;
        }
        kept.push(entry);
    }
    return kept;
}

function newestOwners(index) {
    const owners = new Map();
    index.forEach(function (entries, uid) {
        (entries || []).forEach(function (entry) {
            if (!entry || !entry.token) return;
            const prev = owners.get(entry.token);
            const ms = entry.updatedAtMs || 0;
            if (!prev || ms > prev.updatedAtMs) {
                owners.set(entry.token, { uid: uid, updatedAtMs: ms });
            }
        });
    });
    return owners;
}

function massSendSkipped(userSnap) {
    if (!userSnap.exists) return true;
    const data = userSnap.data() || {};
    return data.banned === true || data.anonymous === true;
}

async function allowRate(uid, category, opts) {
    const base = prefs.RATE_LIMITS[category] || { windowMs: 60 * 60 * 1000, max: 5 };
    const max = opts && opts.rateMax ? opts.rateMax : base.max;
    const windowMs = opts && opts.rateWindowMs ? opts.rateWindowMs : base.windowMs;
    const ref = firestore().collection('rate_limits').doc('push_' + uid + '_' + category);
    const now = Date.now();
    return firestore().runTransaction(async function (tx) {
        const snap = await tx.get(ref);
        let start = now;
        let count = 0;
        if (snap.exists) {
            const data = snap.data() || {};
            start = typeof data.windowStart === 'number' ? data.windowStart : now;
            count = data.count || 0;
            if (now - start >= windowMs) {
                start = now;
                count = 0;
            }
        }
        if (count >= max) return false;
        tx.set(ref, { windowStart: start, count: count + 1, category: category });
        return true;
    });
}

async function deliver(uid, tokens, payload) {
    const messaging = admin.messaging();
    const list = dedupeTokens(tokens);
    if (!list.length) return { sent: 0, failed: 0, reason: 'no-token' };
    const messages = list.map(function (entry) {
        return prefs.buildWebPushMessage(entry.token, payload);
    });
    let sent = 0;
    let failed = 0;
    for (let i = 0; i < messages.length; i += 500) {
        const batch = messages.slice(i, i + 500);
        const batchEntries = list.slice(i, i + 500);
        const result = await messaging.sendEach(batch);
        for (let j = 0; j < result.responses.length; j++) {
            const resp = result.responses[j];
            if (resp.success) {
                sent++;
                continue;
            }
            failed++;
            if (isInvalidTokenError(resp.error)) {
                try { await dropToken(uid, batchEntries[j]); } catch (e) { /* next sweep */ }
            }
        }
    }
    return { sent: sent, failed: failed };
}

async function sendUserPush(uid, category, payload, opts) {
    const options = opts || {};
    if (!uid || !/^[A-Za-z0-9_-]{4,128}$/.test(String(uid))) {
        return { sent: 0, reason: 'bad-uid' };
    }
    if (prefs.CATEGORIES.indexOf(category) === -1) {
        return { sent: 0, reason: 'bad-category' };
    }
    let loaded;
    try {
        loaded = await loadUserTokens(uid);
    } catch (e) {
        console.warn('[push] token load failed', uid, e.message);
        return { sent: 0, reason: 'load-failed' };
    }
    if (!options.ignorePrefs && !prefs.categoryAllowed(loaded.userData, category)) {
        return { sent: 0, reason: 'pref', skipped: true };
    }
    let tokens = loaded.tokens;
    try {
        tokens = await dropForeignCopies(uid, tokens);
    } catch (e) {
        console.warn('[push] token dedupe failed', uid, e.message);
    }
    if (!tokens.length) return { sent: 0, reason: 'no-token' };
    const rateKey = options.rateCategory || category;
    let allowed = false;
    try {
        allowed = await allowRate(uid, rateKey, options);
    } catch (e) {
        console.warn('[push] rate check failed', uid, e.message);
        return { sent: 0, reason: 'rate-error' };
    }
    if (!allowed) return { sent: 0, reason: 'rate' };
    const body = Object.assign({ type: category }, payload || {});
    try {
        return await deliver(uid, tokens, body);
    } catch (e) {
        console.warn('[push] send failed', uid, category, e.message);
        return { sent: 0, reason: 'send-failed' };
    }
}

async function broadcastCategory(category, builder) {
    if (prefs.CATEGORIES.indexOf(category) === -1) {
        return { sent: 0, skipped: 0, failed: 0, reason: 'bad-category' };
    }
    const index = await listTokenIndex();
    const owners = newestOwners(index);
    const uids = Array.from(index.keys());
    const prepared = [];
    let skipped = 0;
    const db = firestore();
    for (let i = 0; i < uids.length; i += PREP_CHUNK) {
        const chunk = uids.slice(i, i + PREP_CHUNK);
        const rows = await Promise.all(chunk.map(async function (uid) {
            try {
                const userSnap = await db.collection('users').doc(uid).get();
                if (massSendSkipped(userSnap)) return null;
                const userData = userSnap.data() || {};
                const entries = (index.get(uid) || []).slice();
                ['fcmToken', 'pushToken'].forEach(function (field) {
                    if (userData[field]) entries.push({ ref: null, token: userData[field], userField: field, updatedAtMs: 0 });
                });
                const tokens = dedupeTokens(entries).filter(function (entry) {
                    const owner = owners.get(entry.token);
                    return !owner || owner.uid === uid;
                });
                if (!tokens.length || !prefs.categoryAllowed(userData, category)) return null;
                const payload = await builder(uid, userData);
                if (!payload) return null;
                const allowed = await allowRate(uid, category, {});
                if (!allowed) return null;
                return { uid: uid, tokens: tokens, payload: Object.assign({ type: category }, payload) };
            } catch (e) {
                return null;
            }
        }));
        rows.forEach(function (row) {
            if (!row) skipped++;
            else prepared.push(row);
        });
    }
    const flat = [];
    const seenToken = {};
    prepared.forEach(function (row) {
        row.tokens.forEach(function (entry) {
            if (seenToken[entry.token]) return;
            seenToken[entry.token] = true;
            flat.push({
                uid: row.uid,
                entry: entry,
                message: prefs.buildWebPushMessage(entry.token, row.payload)
            });
        });
    });
    const messaging = admin.messaging();
    let sent = 0;
    let failed = 0;
    for (let i = 0; i < flat.length; i += 500) {
        const batch = flat.slice(i, i + 500);
        let result;
        try {
            result = await messaging.sendEach(batch.map(function (item) { return item.message; }));
        } catch (e) {
            console.warn('[push] broadcast batch failed', e.message);
            failed += batch.length;
            continue;
        }
        const drops = [];
        for (let j = 0; j < result.responses.length; j++) {
            const resp = result.responses[j];
            if (resp.success) {
                sent++;
                continue;
            }
            failed++;
            if (isInvalidTokenError(resp.error)) {
                drops.push(dropToken(batch[j].uid, batch[j].entry).catch(function () {}));
            }
        }
        if (drops.length) await Promise.all(drops);
    }
    return { sent: sent, skipped: skipped, failed: failed };
}

async function cleanStaleTokens() {
    const index = await listTokenIndex();
    const messaging = admin.messaging();
    const db = firestore();
    let cleaned = 0;
    for (const uid of index.keys()) {
        const entries = index.get(uid).slice();
        try {
            const userSnap = await db.collection('users').doc(uid).get();
            const userData = userSnap.exists ? (userSnap.data() || {}) : {};
            ['fcmToken', 'pushToken'].forEach(function (field) {
                if (userData[field]) entries.push({ ref: null, token: userData[field], userField: field });
            });
        } catch (e) { /* still dry-run the tokens we have */ }
        const tokens = dedupeTokens(entries);
        for (let i = 0; i < tokens.length; i++) {
            const entry = tokens[i];
            if (!entry.token) {
                await dropToken(uid, entry);
                cleaned++;
                continue;
            }
            try {
                await messaging.send({ token: entry.token, data: { type: 'dry' } }, true);
            } catch (e) {
                if (isInvalidTokenError(e)) {
                    await dropToken(uid, entry);
                    cleaned++;
                }
            }
        }
    }
    return cleaned;
}

module.exports = {
    sendUserPush: sendUserPush,
    broadcastCategory: broadcastCategory,
    cleanStaleTokens: cleanStaleTokens,
    loadUserTokens: loadUserTokens,
    categoryAllowed: prefs.categoryAllowed,
    releaseTokenFromOthers: releaseTokenFromOthers,
    capUserDevices: capUserDevices,
    MAX_DEVICES: MAX_DEVICES
};
