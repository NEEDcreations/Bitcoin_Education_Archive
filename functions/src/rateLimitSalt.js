'use strict';

// Network rate-limit keys. A missing DELETE_RATE_IP_SECRET must not fall
// back to a published string: that hash is reversible over IPv4. The server
// writes a random 32-byte salt to rate_limit_salts/{UTC day}. Clients cannot
// read that collection. The salt doc expires after two days.

const crypto = require('crypto');

const SALT_COLLECTION = 'rate_limit_salts';
const PUBLIC_RATE_KEY = /^delete-rate-\d{4}-\d{2}-\d{2}$/;
const SALT_TTL_MS = 48 * 60 * 60 * 1000;
const HASH_ID_RE = /^[a-f0-9]{40}$/;

function utcDay(nowMs) {
    return new Date(nowMs).toISOString().slice(0, 10);
}

function isUsableSecret(secret) {
    return typeof secret === 'string' && secret.length > 0 && !PUBLIC_RATE_KEY.test(secret);
}

function isServerSecret(secret) {
    return isUsableSecret(secret) && secret.length >= 32;
}

function deletionIpDocId(ip, nowMs, secret) {
    if (!isUsableSecret(secret)) {
        const err = new Error('Deletion rate-limit secret is missing');
        err.code = 'failed-precondition';
        throw err;
    }
    const day = utcDay(nowMs);
    const hash = crypto.createHmac('sha256', secret).update(String(ip) + '|' + day).digest('hex').slice(0, 40);
    return 'deleteip_' + hash;
}

function networkRateDocIdFromSecret(prefix, ip, nowMs, secret) {
    if (!isUsableSecret(secret)) {
        const err = new Error('Rate-limit secret is missing');
        err.code = 'failed-precondition';
        throw err;
    }
    const day = utcDay(nowMs);
    const hash = crypto.createHmac('sha256', secret).update(prefix + '|' + String(ip) + '|' + day).digest('hex').slice(0, 40);
    return prefix + hash;
}

async function loadRateLimitSecret(db, nowMs) {
    const fromEnv = process.env.DELETE_RATE_IP_SECRET;
    if (isServerSecret(fromEnv)) return fromEnv;
    if (!db || typeof db.runTransaction !== 'function' || typeof db.collection !== 'function') {
        const err = new Error('Deletion rate-limit secret is missing');
        err.code = 'failed-precondition';
        throw err;
    }
    const day = utcDay(nowMs);
    const ref = db.collection(SALT_COLLECTION).doc(day);
    const created = crypto.randomBytes(32).toString('hex');
    return db.runTransaction(async function(tx) {
        const snap = await tx.get(ref);
        const existing = snap && snap.exists ? String((snap.data() || {}).salt || '') : '';
        if (isServerSecret(existing)) return existing;
        tx.set(ref, {
            salt: created,
            expireAt: new Date(nowMs + SALT_TTL_MS),
        });
        return created;
    });
}

async function networkRateDocId(db, prefix, ip, nowMs) {
    const secret = await loadRateLimitSecret(db, nowMs);
    return networkRateDocIdFromSecret(prefix, ip, nowMs, secret);
}

async function commitDeletes(db, refs) {
    if (!refs.length) return 0;
    if (typeof db.batch === 'function') {
        const batch = db.batch();
        refs.forEach(function(ref) { batch.delete(ref); });
        await batch.commit();
        return refs.length;
    }
    for (let i = 0; i < refs.length; i++) {
        if (typeof refs[i].delete === 'function') await refs[i].delete();
    }
    return refs.length;
}

// Fallback for the Firestore TTL policy on rate_limits.expireAt. Also drops
// legacy nostr_/lnauth_ rows whose ids still contain a raw address, and
// salts whose expireAt has passed.
async function deleteExpiredRateRows(db, nowMs, options) {
    const opts = options || {};
    const cap = opts.limit > 0 ? opts.limit : 200;
    const now = new Date(nowMs);
    const documentIdField = opts.documentIdField;
    let rateLimits = 0;
    let salts = 0;
    let legacy = 0;

    const expired = await db.collection('rate_limits').where('expireAt', '<', now).limit(cap).get();
    rateLimits = await commitDeletes(db, (expired.docs || []).map(function(doc) { return doc.ref; }));

    const oldSalts = await db.collection(SALT_COLLECTION).where('expireAt', '<', now).limit(cap).get();
    salts = await commitDeletes(db, (oldSalts.docs || []).map(function(doc) { return doc.ref; }));

    if (documentIdField) {
        const prefixes = ['nostr_', 'lnauth_'];
        for (let i = 0; i < prefixes.length; i++) {
            const prefix = prefixes[i];
            const snap = await db.collection('rate_limits')
                .where(documentIdField, '>=', prefix)
                .where(documentIdField, '<', prefix + '\uf8ff')
                .limit(cap)
                .get();
            const stale = [];
            (snap.docs || []).forEach(function(doc) {
                const rest = String(doc.id || '').slice(prefix.length);
                if (!HASH_ID_RE.test(rest)) stale.push(doc.ref);
            });
            legacy += await commitDeletes(db, stale);
        }
    }
    return { rateLimits: rateLimits, salts: salts, legacy: legacy };
}

module.exports = {
    SALT_COLLECTION: SALT_COLLECTION,
    PUBLIC_RATE_KEY: PUBLIC_RATE_KEY,
    SALT_TTL_MS: SALT_TTL_MS,
    isUsableSecret: isUsableSecret,
    isServerSecret: isServerSecret,
    deletionIpDocId: deletionIpDocId,
    networkRateDocIdFromSecret: networkRateDocIdFromSecret,
    loadRateLimitSecret: loadRateLimitSecret,
    networkRateDocId: networkRateDocId,
    deleteExpiredRateRows: deleteExpiredRateRows,
};
