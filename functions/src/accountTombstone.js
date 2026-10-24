'use strict';

// Hashed identity records for a deleted account. The document id is
// HMAC-SHA256(DELETION_HMAC_SECRET, material). No email, IP, username, or
// post body is stored. Lookup is a no-op when the secret is missing so
// existing faucet and referral tests keep working. Deletion fails closed
// when an identity exists and the secret is missing.

const crypto = require('crypto');

const SECRET_ENV = 'DELETION_HMAC_SECRET';
const HASH_LIMIT = 3;
const HASH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const CLEAN_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
const MIN_SECRET_LEN = 16;

function secretValue() {
    const raw = process.env[SECRET_ENV] || '';
    if (typeof raw !== 'string') return '';
    const trimmed = raw.trim();
    if (trimmed.length < MIN_SECRET_LEN) return '';
    return trimmed;
}

function secretReady() {
    return !!secretValue();
}

function hmacHex(material) {
    const secret = secretValue();
    if (!secret || material == null || material === '') return '';
    return crypto.createHmac('sha256', secret).update(String(material), 'utf8').digest('hex');
}

function normalizeEmail(email) {
    const value = String(email || '').trim().toLowerCase();
    if (!value || value.indexOf('@') < 1 || value.length > 320) return '';
    return value;
}

function emailMaterial(email) {
    const normalized = normalizeEmail(email);
    return normalized ? ('email:' + normalized) : '';
}

function emailHmac(email) {
    return hmacHex(emailMaterial(email));
}

function identityMaterials(spec) {
    const src = spec || {};
    const out = [];
    const emailMat = emailMaterial(src.email);
    if (emailMat) out.push(emailMat);
    const providers = Array.isArray(src.providers) ? src.providers : [];
    providers.forEach(function (row) {
        if (!row) return;
        const id = String(row.providerId || '');
        const puid = String(row.uid || '').trim();
        if (!puid || puid.length > 256) return;
        if (id === 'google.com') out.push('google:' + puid);
        else if (id === 'twitter.com') out.push('twitter:' + puid);
        else if (id === 'github.com') out.push('github:' + puid);
        else if (id === 'facebook.com') out.push('facebook:' + puid);
    });
    const uid = String(src.uid || '');
    if (uid.indexOf('nostr:') === 0) {
        const pubkey = uid.slice('nostr:'.length).trim().toLowerCase();
        if (pubkey) out.push('nostr:' + pubkey);
    } else if (uid.indexOf('ln:') === 0) {
        const key = uid.slice('ln:'.length).trim();
        if (key) out.push('ln:' + key);
    }
    const seen = {};
    return out.filter(function (material) {
        if (seen[material]) return false;
        seen[material] = true;
        return true;
    });
}

function identityFrom(spec) {
    const src = spec || {};
    const authUser = src.authUser || null;
    const token = src.token || {};
    const user = src.user || {};
    const email = (authUser && authUser.email) || token.email || user.email || '';
    let providers = Array.isArray(src.providers) ? src.providers : [];
    if (!providers.length && authUser && Array.isArray(authUser.providerData)) {
        providers = authUser.providerData.map(function (row) {
            return {
                providerId: row && row.providerId,
                uid: row && row.uid,
            };
        });
    }
    return {
        uid: src.uid || (authUser && authUser.uid) || '',
        email: email,
        providers: providers,
    };
}

function hashIdsFor(spec) {
    return identityMaterials(spec).map(hmacHex).filter(Boolean);
}

function emptySummary() {
    return {
        banned: false,
        satsDisabled: false,
        ledgerBanned: false,
        flagged: false,
        faucetClaimed: false,
        referralRedeemed: false,
        lifetimeSats: 0,
        ageDays: 0,
    };
}

function summarizeTombstones(docs) {
    const out = emptySummary();
    (docs || []).forEach(function (doc) {
        if (!doc) return;
        if (doc.banned === true) out.banned = true;
        if (doc.satsDisabled === true) out.satsDisabled = true;
        if (doc.ledgerBanned === true) out.ledgerBanned = true;
        if (doc.flagged === true) out.flagged = true;
        if (doc.faucetClaimed === true) out.faucetClaimed = true;
        if (doc.referralRedeemed === true) out.referralRedeemed = true;
        out.lifetimeSats = Math.max(out.lifetimeSats, Number(doc.lifetimeSats) || 0);
        out.ageDays = Math.max(out.ageDays, Number(doc.ageDays) || 0);
    });
    return out;
}

function recentHits(hits, nowMs) {
    const now = Number(nowMs) || 0;
    return (Array.isArray(hits) ? hits : []).map(function (ms) {
        return Number(ms) || 0;
    }).filter(function (ms) {
        return ms > 0 && now >= ms && (now - ms) < HASH_WINDOW_MS;
    });
}

function overDeletionLimit(hits, nowMs) {
    return recentHits(hits, nowMs).length >= HASH_LIMIT;
}

function shouldRetain(record) {
    if (!record) return false;
    if (record.banned || record.flagged || record.satsDisabled || record.ledgerBanned) return true;
    if ((Number(record.lifetimeSats) || 0) > 0) return true;
    if (record.faucetClaimed) return true;
    return false;
}

function buildRecord(input) {
    const src = input || {};
    const now = Number(src.nowMs) || Date.now();
    const withdrawn = Math.max(Number(src.satsWithdrawn) || 0, Number(src.ledgerSatsWithdrawn) || 0);
    const lifetimeSats = (Number(src.priorLifetimeSats) || 0) + withdrawn;
    const ageDays = Math.max(Number(src.priorAgeDays) || 0, Number(src.ageDays) || 0);
    const faucetClaimed = src.faucetClaimed === true || withdrawn > 0 || !!src.lastSatsClaim;
    const record = {
        deletedAt: now,
        oldUidPrefix: String(src.uid || '').slice(0, 8),
        banned: src.banned === true,
        satsDisabled: src.satsDisabled === true,
        ledgerBanned: src.ledgerBanned === true,
        flagged: src.flagged === true,
        faucetClaimed: faucetClaimed,
        lifetimeSats: lifetimeSats,
        referralRedeemed: src.referralRedeemed === true,
        ageDays: ageDays,
        deletionHits: recentHits(src.priorHits, now).concat([now]),
    };
    if (!shouldRetain(record)) record.expireAt = new Date(now + CLEAN_RETENTION_MS);
    return record;
}

function mergeRecord(prev, next) {
    const record = Object.assign({}, next);
    const prior = prev || {};
    record.banned = record.banned || prior.banned === true;
    record.satsDisabled = record.satsDisabled || prior.satsDisabled === true;
    record.ledgerBanned = record.ledgerBanned || prior.ledgerBanned === true;
    record.flagged = record.flagged || prior.flagged === true;
    record.faucetClaimed = record.faucetClaimed || prior.faucetClaimed === true;
    record.referralRedeemed = record.referralRedeemed || prior.referralRedeemed === true;
    if (shouldRetain(record)) delete record.expireAt;
    return record;
}

function applyFlagsPatch(summary) {
    const user = {};
    const ledger = {};
    if (!summary) return { user: user, ledger: ledger };
    if (summary.banned) user.banned = true;
    if (summary.satsDisabled || summary.ledgerBanned) user.satsDisabled = true;
    if (summary.ledgerBanned) ledger.banned = true;
    return { user: user, ledger: ledger };
}

function effectiveAgeDays(authAgeDays, summary) {
    return Math.max(Number(authAgeDays) || 0, summary ? (Number(summary.ageDays) || 0) : 0);
}

function effectiveWithdrawn(current, summary) {
    return (Number(current) || 0) + (summary ? (Number(summary.lifetimeSats) || 0) : 0);
}

function pulledCreatedMs(authCreatedMs, summary, nowMs) {
    const now = Number(nowMs) || Date.now();
    const auth = authCreatedMs == null || authCreatedMs === '' ? null : Number(authCreatedMs);
    const ageDays = summary ? (Number(summary.ageDays) || 0) : 0;
    const pulled = ageDays > 0 ? (now - ageDays * 86400000) : null;
    if (auth == null || !isFinite(auth)) return pulled;
    if (pulled == null) return auth;
    return Math.min(auth, pulled);
}

async function readTombstones(db, hashes) {
    const out = [];
    const ids = hashes || [];
    for (let i = 0; i < ids.length; i++) {
        const snap = await db.collection('deleted_accounts').doc(ids[i]).get();
        if (snap && snap.exists) out.push(Object.assign({ id: ids[i] }, snap.data() || {}));
    }
    return out;
}

async function lookupByMaterials(db, spec) {
    if (!secretReady()) {
        return { configured: false, hashes: [], docs: [], summary: emptySummary() };
    }
    const hashes = hashIdsFor(spec || {});
    const docs = await readTombstones(db, hashes);
    return {
        configured: true,
        hashes: hashes,
        docs: docs,
        summary: summarizeTombstones(docs),
    };
}

async function assertDeletionAllowed(db, spec, nowMs) {
    const materials = identityMaterials(spec || {});
    if (!secretReady()) {
        if (materials.length) {
            const err = new Error('Account deletion is unavailable right now.');
            err.code = 'failed-precondition';
            throw err;
        }
        return { hashes: [], docs: [], materials: materials };
    }
    const hashes = materials.map(hmacHex).filter(Boolean);
    const docs = await readTombstones(db, hashes);
    const byId = {};
    docs.forEach(function (doc) { byId[doc.id] = doc; });
    for (let i = 0; i < hashes.length; i++) {
        const row = byId[hashes[i]];
        if (row && overDeletionLimit(row.deletionHits, nowMs)) {
            const err = new Error('Too many account deletions from this network. Try again later.');
            err.code = 'resource-exhausted';
            throw err;
        }
    }
    return { hashes: hashes, docs: docs, materials: materials };
}

async function writeTombstones(db, spec) {
    const src = spec || {};
    const hashes = src.hashes || [];
    if (!hashes.length || !secretReady()) return;
    const docs = src.docs || [];
    let priorLifetime = 0;
    let priorAge = 0;
    const byId = {};
    docs.forEach(function (doc) {
        byId[doc.id] = doc;
        priorLifetime = Math.max(priorLifetime, Number(doc.lifetimeSats) || 0);
        priorAge = Math.max(priorAge, Number(doc.ageDays) || 0);
    });
    const now = Number(src.nowMs) || Date.now();
    for (let i = 0; i < hashes.length; i++) {
        const prev = byId[hashes[i]] || {};
        const record = mergeRecord(prev, buildRecord(Object.assign({}, src, {
            priorLifetimeSats: priorLifetime,
            priorAgeDays: priorAge,
            priorHits: prev.deletionHits || [],
            nowMs: now,
        })));
        await db.collection('deleted_accounts').doc(hashes[i]).set(record);
    }
}

async function applyIdentityFlags(db, uid, summary) {
    const patch = applyFlagsPatch(summary);
    if (!uid) return patch;
    if (Object.keys(patch.user).length) {
        await db.collection('users').doc(uid).set(patch.user, { merge: true });
    }
    if (Object.keys(patch.ledger).length) {
        await db.collection('faucet_ledger').doc(uid).set(patch.ledger, { merge: true });
    }
    return patch;
}

module.exports = {
    SECRET_ENV: SECRET_ENV,
    HASH_LIMIT: HASH_LIMIT,
    HASH_WINDOW_MS: HASH_WINDOW_MS,
    CLEAN_RETENTION_MS: CLEAN_RETENTION_MS,
    secretReady: secretReady,
    hmacHex: hmacHex,
    normalizeEmail: normalizeEmail,
    emailMaterial: emailMaterial,
    emailHmac: emailHmac,
    identityMaterials: identityMaterials,
    identityFrom: identityFrom,
    hashIdsFor: hashIdsFor,
    emptySummary: emptySummary,
    summarizeTombstones: summarizeTombstones,
    recentHits: recentHits,
    overDeletionLimit: overDeletionLimit,
    shouldRetain: shouldRetain,
    buildRecord: buildRecord,
    applyFlagsPatch: applyFlagsPatch,
    effectiveAgeDays: effectiveAgeDays,
    effectiveWithdrawn: effectiveWithdrawn,
    pulledCreatedMs: pulledCreatedMs,
    lookupByMaterials: lookupByMaterials,
    assertDeletionAllowed: assertDeletionAllowed,
    writeTombstones: writeTombstones,
    applyIdentityFlags: applyIdentityFlags,
};
