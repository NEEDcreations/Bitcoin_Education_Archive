'use strict';

// Second factor for Bitcoin Quest.
// Phone sign-in is Firebase Phone Multi-Factor. Authenticator codes are TOTP
// checked here. A successful authenticator check writes a short-lived session
// the sensitive callables require. Recovery codes are stored only as salted
// hashes. Nothing in this file prints a secret or the encryption key.

const crypto = require('crypto');
const functionsV1 = require('firebase-functions/v1');
const faucetGuard = require('./faucetGuard');
const { networkRateDocId } = require('./rateLimitSalt');

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const FRESH_TTL_MS = 5 * 60 * 1000;
const RATE_WINDOW_MS = 120000;
const RATE_MAX = 5;
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const DAILY_FAIL_MAX = 20;
const MAX_TRUSTED_DEVICES = 10;
const FRESH_ACTIONS = {
    resetLightningAddress: true,
    disableTotp: true,
    regenerateRecoveryCodes: true,
    deleteAccount: true,
};
const RECOVERY_COUNT = 10;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const STEP_MS = 30000;

let singleton = null;

function currentNow() {
    // Tests move this clock. Production never sets it.
    const hook = global.__BTC_MFA_NOW__;
    if (typeof hook === 'function') return hook();
    return Date.now();
}

function keyBuffer() {
    const hex = process.env.TOTP_ENCRYPTION_KEY || '';
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) return null;
    return Buffer.from(hex, 'hex');
}

function encryptionKeyConfigured() {
    return !!keyBuffer();
}

function encryptTotpSecret(secret) {
    const key = keyBuffer();
    if (!key) {
        const err = new Error('TOTP_ENCRYPTION_KEY missing');
        err.code = 'missing-key';
        throw err;
    }
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        enc: true,
        value: iv.toString('hex') + ':' + enc.toString('hex') + ':' + tag.toString('hex'),
    };
}

function decryptTotpSecret(stored) {
    if (!stored) return null;
    if (!stored.enc) return stored.value || null;
    const key = keyBuffer();
    if (!key) {
        const err = new Error('TOTP_ENCRYPTION_KEY missing');
        err.code = 'missing-key';
        throw err;
    }
    const parts = String(stored.value || '').split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted TOTP format');
    const iv = Buffer.from(parts[0], 'hex');
    const encBuf = Buffer.from(parts[1], 'hex');
    const tag = Buffer.from(parts[2], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encBuf), decipher.final()]).toString('utf8');
}

function normalizeRecoveryCode(code) {
    return String(code || '').toUpperCase().replace(/[^A-Z2-9]/g, '');
}

function formatRecoveryCode(raw) {
    return raw.slice(0, 4) + '-' + raw.slice(4);
}

function hashRecoveryCode(normalized, salt) {
    return crypto.scryptSync(normalized, salt, 32, { N: 16384, r: 8, p: 1 });
}

function hashesEqual(a, b) {
    if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b) || a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

function generateRecoveryCodes() {
    const plain = [];
    const records = [];
    for (let i = 0; i < RECOVERY_COUNT; i++) {
        const bytes = crypto.randomBytes(8);
        let raw = '';
        for (let n = 0; n < 8; n++) raw += CODE_ALPHABET[bytes[n] % CODE_ALPHABET.length];
        const salt = crypto.randomBytes(16);
        plain.push(formatRecoveryCode(raw));
        records.push({
            salt: salt.toString('hex'),
            hash: hashRecoveryCode(raw, salt).toString('hex'),
            used: false,
        });
    }
    return { plain: plain, records: records };
}

function codeMatches(records, normalized) {
    let matched = -1;
    const list = Array.isArray(records) ? records : [];
    for (let i = 0; i < list.length; i++) {
        const row = list[i];
        if (!row || !row.salt || !row.hash) continue;
        let ok = false;
        try {
            const got = hashRecoveryCode(normalized, Buffer.from(row.salt, 'hex'));
            ok = hashesEqual(got, Buffer.from(row.hash, 'hex'));
        } catch (e) {
            ok = false;
        }
        if (ok && row.used !== true && matched < 0) matched = i;
    }
    return matched;
}

function totpDelta(authenticator, token, secret, nowMs) {
    const prev = Object.assign({}, authenticator.options);
    authenticator.options = Object.assign({}, prev, { step: 30, window: 1, epoch: nowMs });
    try {
        return authenticator.checkDelta(String(token || ''), secret);
    } finally {
        authenticator.options = prev;
    }
}

function sha(value) {
    return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 40);
}

// Browser and OS only. The raw User-Agent and any address in it are dropped.
function deviceLabel(ua) {
    const raw = String(ua || '').slice(0, 400);
    const browsers = [
        ['Edge', /Edg\//],
        ['Opera', /OPR\/|Opera/],
        ['Chrome', /Chrome\/|CriOS\//],
        ['Firefox', /Firefox\/|FxiOS\//],
        ['Safari', /Safari\//],
    ];
    const systems = [
        ['iOS', /iPhone|iPad|iPod/],
        ['Android', /Android/],
        ['ChromeOS', /CrOS/],
        ['Windows', /Windows/],
        ['macOS', /Mac OS X|Macintosh/],
        ['Linux', /Linux/],
    ];
    let browser = 'Browser';
    let os = 'Unknown OS';
    for (let i = 0; i < browsers.length; i++) {
        if (browsers[i][1].test(raw)) { browser = browsers[i][0]; break; }
    }
    for (let i = 0; i < systems.length; i++) {
        if (systems[i][1].test(raw)) { os = systems[i][0]; break; }
    }
    return (browser + ' on ' + os).slice(0, 40);
}

function hashDeviceToken(token) {
    if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return '';
    return crypto.createHash('sha256').update(Buffer.from(token, 'hex')).digest('hex');
}

function sameSecret(left, right) {
    const a = Buffer.from(String(left || ''), 'utf8');
    const b = Buffer.from(String(right || ''), 'utf8');
    if (a.length !== b.length || a.length === 0) return false;
    return crypto.timingSafeEqual(a, b);
}

function parseAuthTimeMs(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'number' && Number.isFinite(value)) return value < 1e12 ? value * 1000 : value;
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
}

function userAgentFrom(context) {
    const req = context && context.rawRequest;
    const headers = (req && req.headers) || {};
    return String(headers['user-agent'] || headers['User-Agent'] || '').slice(0, 400);
}

function isAnon(context) {
    return !!(context && context.auth && context.auth.token && context.auth.token.firebase
        && context.auth.token.firebase.sign_in_provider === 'anonymous');
}

async function migratePlaintextSecrets(db, options) {
    const apply = !!(options && options.apply);
    const keyOk = encryptionKeyConfigured();
    const summary = {
        keyConfigured: keyOk,
        apply: apply,
        plaintext: 0,
        encrypted: 0,
        pendingPlain: 0,
        pendingEncrypted: 0,
        updated: 0,
        skipped: 0,
    };
    async function walk(collectionName, plainKey, encKey) {
        const snap = await db.collection(collectionName).get();
        for (const doc of snap.docs) {
            const data = doc.data() || {};
            if (data.secretEnc === true) {
                summary[encKey] += 1;
                continue;
            }
            if (typeof data.secret !== 'string' || !data.secret) {
                summary.skipped += 1;
                continue;
            }
            summary[plainKey] += 1;
            if (!apply) continue;
            if (!keyOk) {
                const err = new Error('TOTP_ENCRYPTION_KEY missing');
                err.code = 'missing-key';
                throw err;
            }
            const enc = encryptTotpSecret(data.secret);
            await doc.ref.update({ secretEnc: true, secret: enc.value });
            summary.updated += 1;
        }
    }
    await walk('totp_secrets', 'plaintext', 'encrypted');
    await walk('totp_pending', 'pendingPlain', 'pendingEncrypted');
    return summary;
}

function initSecondFactor(deps) {
    const db = deps.db;
    const admin = deps.admin;
    const HttpsError = deps.HttpsError || functionsV1.https.HttpsError;
    const authenticator = deps.authenticator;
    const QRCode = deps.QRCode;
    // Cloud Functions mounts this Secret Manager secret as
    // process.env.TOTP_ENCRYPTION_KEY. New setup fails closed when it is absent.
    // Sign-in still accepts a legacy plaintext secret so existing users are not
    // locked out before migrate-totp-secrets.js --apply.
    const onCallWithKey = functionsV1.runWith({ secrets: ['TOTP_ENCRYPTION_KEY'] }).https.onCall;
    const phoneCache = new Map();

    function httpError(code, message) {
        return new HttpsError(code, message);
    }

    function forgetPhone(uid) {
        phoneCache.delete(uid);
    }

    async function phoneInfo(uid) {
        const cached = phoneCache.get(uid);
        if (cached && (currentNow() - cached.at) < 60000) return cached.value;
        let value = { enrolled: false, enrollmentTime: 0 };
        try {
            const rec = await admin.auth().getUser(uid);
            const factors = (rec.multiFactor && rec.multiFactor.enrolledFactors) || [];
            const phone = factors.filter(function (f) { return f && f.factorId === 'phone'; });
            value = {
                enrolled: phone.length > 0,
                enrollmentTime: phone[0] && phone[0].enrollmentTime ? new Date(phone[0].enrollmentTime).getTime() : 0,
            };
        } catch (e) {
            value = { enrolled: false, enrollmentTime: 0, missing: true };
        }
        phoneCache.set(uid, { at: currentNow(), value: value });
        return value;
    }

    function stamp(data, context) {
        const ctx = context || {};
        const raw = data && typeof data.mfaSessionId === 'string' ? data.mfaSessionId : '';
        ctx.mfaSessionId = /^[a-f0-9]{64}$/.test(raw) ? raw : '';
        const proof = data && typeof data.freshProofId === 'string' ? data.freshProofId : '';
        ctx.freshProofId = /^[a-f0-9]{32}$/.test(proof) ? proof : '';
        const code = data && typeof data.code === 'string' ? data.code.trim() : '';
        ctx.freshCode = /^\d{6}$/.test(code) ? code : '';
        return ctx;
    }

    async function sessionValid(uid, sessionId, nowMs) {
        if (!sessionId || !/^[a-f0-9]{64}$/.test(sessionId)) return null;
        const snap = await db.collection('totp_sessions').doc(uid + '_' + sessionId).get();
        if (!snap.exists) return null;
        const row = snap.data() || {};
        if (row.uid !== uid) return null;
        if (row.revoked === true) return null;
        if (!(typeof row.expiresAtMs === 'number' && row.expiresAtMs > nowMs)) return null;
        return row;
    }

    async function issueSession(uid, nowMs) {
        const sessionId = crypto.randomBytes(32).toString('hex');
        const expiresAtMs = nowMs + SESSION_TTL_MS;
        await db.collection('totp_sessions').doc(uid + '_' + sessionId).set({
            uid: uid,
            sessionId: sessionId,
            expiresAtMs: expiresAtMs,
            expireAt: new Date(expiresAtMs),
            revoked: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await db.collection('totp_sessions').doc(uid).delete().catch(function () {});
        return { sessionId: sessionId, expiresAtMs: expiresAtMs };
    }

    async function deviceByToken(token) {
        const tokenHash = hashDeviceToken(token);
        if (!tokenHash) return null;
        const snap = await db.collection('trusted_devices').where('tokenHash', '==', tokenHash).limit(2).get();
        if (snap.size !== 1) return null;
        let found = null;
        snap.forEach(function (doc) {
            found = { ref: doc.ref, id: doc.id, row: doc.data() || {}, tokenHash: tokenHash };
        });
        return found;
    }

    // exceptHash keeps one device (sign out others). Empty revokes every device.
    // The 30-day expiry is not touched. Revoked tokens never resume.
    async function revokeTrustedDevices(uid, exceptHash) {
        const snap = await db.collection('trusted_devices').where('uid', '==', uid).get();
        const refs = [];
        snap.forEach(function (doc) {
            const row = doc.data() || {};
            if (row.revoked === true) return;
            if (exceptHash && row.tokenHash === exceptHash) return;
            refs.push(doc.ref);
        });
        const nowMs = currentNow();
        let revoked = 0;
        for (let i = 0; i < refs.length; i += 400) {
            const slice = refs.slice(i, i + 400);
            if (!slice.length) continue;
            const batch = db.batch();
            slice.forEach(function (ref) {
                batch.update(ref, { revoked: true, revokedAtMs: nowMs });
            });
            await batch.commit();
            revoked += slice.length;
        }
        return revoked;
    }

    async function revokeOtherSessions(uid, keepSessionId) {
        const snap = await db.collection('totp_sessions').where('uid', '==', uid).get();
        const batch = db.batch();
        let n = 0;
        snap.forEach(function (doc) {
            const row = doc.data() || {};
            if (keepSessionId && (doc.id === uid + '_' + keepSessionId || row.sessionId === keepSessionId)) return;
            batch.delete(doc.ref);
            n += 1;
        });
        if (!keepSessionId) batch.delete(db.collection('totp_sessions').doc(uid));
        if (n || !keepSessionId) await batch.commit();
    }

    async function evictOldestTrustedDevices(uid, nowMs) {
        const snap = await db.collection('trusted_devices').where('uid', '==', uid).get();
        const active = [];
        snap.forEach(function (doc) {
            const row = doc.data() || {};
            if (row.revoked === true) return;
            if (!(typeof row.expiresAtMs === 'number' && row.expiresAtMs > nowMs)) return;
            active.push({
                ref: doc.ref,
                id: doc.id,
                createdAtMs: typeof row.createdAtMs === 'number' ? row.createdAtMs : 0,
            });
        });
        active.sort(function (a, b) {
            if (a.createdAtMs !== b.createdAtMs) return a.createdAtMs - b.createdAtMs;
            if (a.id < b.id) return -1;
            if (a.id > b.id) return 1;
            return 0;
        });
        const extra = active.length - (MAX_TRUSTED_DEVICES - 1);
        if (extra <= 0) return;
        const batch = db.batch();
        for (let i = 0; i < extra; i++) {
            batch.update(active[i].ref, { revoked: true, revokedAtMs: nowMs });
        }
        await batch.commit();
    }

    async function issueTrustedDevice(uid, nowMs, context, previousToken) {
        const tokenBuf = crypto.randomBytes(32);
        const token = tokenBuf.toString('hex');
        const tokenHash = crypto.createHash('sha256').update(tokenBuf).digest('hex');
        const id = crypto.randomBytes(16).toString('hex');
        const expiresAtMs = nowMs + DEVICE_TTL_MS;
        const label = deviceLabel(userAgentFrom(context));
        if (previousToken && previousToken !== token) {
            const old = await deviceByToken(previousToken);
            if (old && old.row.uid === uid && old.tokenHash !== tokenHash && old.row.revoked !== true) {
                await old.ref.update({ revoked: true, revokedAtMs: nowMs });
            }
        }
        await evictOldestTrustedDevices(uid, nowMs);
        // expiresAt is the Firestore TTL field. Turn on a TTL policy for
        // trusted_devices.expiresAt. The server still rejects expired rows immediately.
        await db.collection('trusted_devices').doc(id).set({
            uid: uid,
            tokenHash: tokenHash,
            label: label,
            createdAtMs: nowMs,
            lastUsedAtMs: nowMs,
            expiresAtMs: expiresAtMs,
            revoked: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: new Date(expiresAtMs),
        });
        return token;
    }

    async function issueFreshProof(uid, action, nowMs) {
        if (!FRESH_ACTIONS[action]) throw httpError('invalid-argument', 'Unknown action');
        const proofId = crypto.randomBytes(16).toString('hex');
        const expiresAtMs = nowMs + FRESH_TTL_MS;
        await db.collection('totp_fresh_proofs').doc(uid + '_' + action).set({
            uid: uid,
            action: action,
            proofId: proofId,
            verifiedAtMs: nowMs,
            expiresAtMs: expiresAtMs,
            consumed: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: new Date(expiresAtMs),
        });
        return { proofId: proofId, expiresAtMs: expiresAtMs };
    }

    async function consumeFreshProof(uid, action, proofId, nowMs) {
        if (!FRESH_ACTIONS[action]) throw httpError('invalid-argument', 'Unknown action');
        if (!/^[a-f0-9]{32}$/.test(proofId || '')) {
            throw httpError('failed-precondition', 'Enter a fresh authenticator code for this action.');
        }
        const ref = db.collection('totp_fresh_proofs').doc(uid + '_' + action);
        const ok = await db.runTransaction(async function (tx) {
            const snap = await tx.get(ref);
            if (!snap.exists) return false;
            const row = snap.data() || {};
            if (row.uid !== uid) return false;
            if (row.action !== action) return false;
            if (!sameSecret(row.proofId, proofId)) return false;
            if (row.consumed === true) return false;
            if (!(typeof row.verifiedAtMs === 'number' && row.verifiedAtMs <= nowMs && (nowMs - row.verifiedAtMs) <= FRESH_TTL_MS)) return false;
            if (!(typeof row.expiresAtMs === 'number' && row.expiresAtMs > nowMs)) return false;
            tx.update(ref, { consumed: true, consumedAtMs: nowMs });
            return true;
        });
        if (!ok) throw httpError('failed-precondition', 'Enter a fresh authenticator code for this action.');
    }

    // Sessions and trusted devices are ignored. A code verified in the last
    // five minutes, bound to this action, is the only authenticator proof.
    async function proveFreshCode(data, context, uid, action, nowMs) {
        const secret = await secretRecord(uid);
        if (!secret) {
            const token = (context && context.auth && context.auth.token && context.auth.token.firebase) || {};
            if (token.sign_in_second_factor) return 'phone';
            throw httpError('failed-precondition', 'Enter a fresh authenticator code for this action.');
        }
        const proofId = data && typeof data.freshProofId === 'string' ? data.freshProofId : '';
        if (/^[a-f0-9]{32}$/.test(proofId)) {
            await consumeFreshProof(uid, action, proofId, nowMs);
            return 'proof';
        }
        const code = data && data.code ? String(data.code).trim() : '';
        if (!/^\d{6}$/.test(code)) {
            throw httpError('failed-precondition', 'Enter a fresh authenticator code for this action.');
        }
        await acceptTotp(uid, code, nowMs);
        return 'totp';
    }

    async function requireFreshStepUp(context, action) {
        if (!FRESH_ACTIONS[action]) throw httpError('invalid-argument', 'Unknown action');
        if (!context || !context.auth || !context.auth.uid) {
            throw httpError('unauthenticated', 'Must be signed in');
        }
        const uid = context.auth.uid;
        const nowMs = currentNow();
        const [secret, userSnap, phone] = await Promise.all([
            secretRecord(uid),
            db.collection('users').doc(uid).get(),
            phoneInfo(uid),
        ]);
        const userData = userSnap.exists ? (userSnap.data() || {}) : {};
        if (secret) {
            const proofId = context.freshProofId || '';
            const code = context.freshCode || '';
            if (/^[a-f0-9]{32}$/.test(proofId)) {
                await consumeFreshProof(uid, action, proofId, nowMs);
            } else if (/^\d{6}$/.test(code)) {
                await acceptTotp(uid, code, nowMs);
            } else {
                throw httpError('failed-precondition', 'Enter a fresh authenticator code for this action.');
            }
        }
        const phoneMust = phone.enrolled === true || (phone.missing === true && userData.phoneVerified === true);
        if (phoneMust) {
            const token = (context.auth.token && context.auth.token.firebase) || {};
            if (!token.sign_in_second_factor) {
                throw httpError('failed-precondition', 'Sign in again so your phone verification applies.');
            }
        }
        return { uid: uid, totp: !!secret, phone: phone.enrolled === true };
    }

    async function revokeSessions(uid, sessionId) {
        const snap = await db.collection('totp_sessions').where('uid', '==', uid).get();
        const batch = db.batch();
        let n = 0;
        snap.forEach(function (doc) {
            if (!sessionId || doc.id === uid + '_' + sessionId || (doc.data() || {}).sessionId === sessionId) {
                batch.delete(doc.ref);
                n += 1;
            }
        });
        if (!sessionId) batch.delete(db.collection('totp_sessions').doc(uid));
        if (n || !sessionId) await batch.commit();
    }

    async function takeAttempt(docId, nowMs) {
        const ref = db.collection('totp_rate_limits').doc(docId);
        const result = await db.runTransaction(async function (tx) {
            const snap = await tx.get(ref);
            let attempts = 0;
            let windowStart = nowMs;
            if (snap.exists) {
                const row = snap.data() || {};
                let ws = 0;
                if (typeof row.windowStartMs === 'number') ws = row.windowStartMs;
                else if (row.windowStart && row.windowStart.toDate) ws = row.windowStart.toDate().getTime();
                if (ws && (nowMs - ws) < RATE_WINDOW_MS) {
                    attempts = row.attempts || 0;
                    windowStart = ws;
                    if (attempts >= RATE_MAX) return { limited: true };
                }
            }
            tx.set(ref, {
                attempts: attempts + 1,
                windowStartMs: windowStart,
                expireAt: new Date(windowStart + RATE_WINDOW_MS),
            });
            return { limited: false };
        });
        if (result.limited) throw httpError('resource-exhausted', 'Too many attempts. Wait 2 minutes.');
    }

    // Recovery attempts from one address share a salted daily id in rate_limits.
    // expireAt lets the hourly cleanup drop the row after the window.
    async function takeNetworkAttempt(docId, nowMs) {
        const ref = db.collection('rate_limits').doc(docId);
        const result = await db.runTransaction(async function (tx) {
            const snap = await tx.get(ref);
            let attempts = 0;
            let windowStart = nowMs;
            if (snap.exists) {
                const row = snap.data() || {};
                let ws = 0;
                if (typeof row.windowStartMs === 'number') ws = row.windowStartMs;
                else if (row.windowStart && row.windowStart.toDate) ws = row.windowStart.toDate().getTime();
                if (ws && (nowMs - ws) < RATE_WINDOW_MS) {
                    attempts = row.attempts || 0;
                    windowStart = ws;
                    if (attempts >= RATE_MAX) return { limited: true };
                }
            }
            tx.set(ref, {
                attempts: attempts + 1,
                windowStartMs: windowStart,
                expireAt: new Date(windowStart + RATE_WINDOW_MS),
            });
            return { limited: false };
        });
        if (result.limited) throw httpError('resource-exhausted', 'Too many attempts. Wait 2 minutes.');
    }

    async function clearAttempt(docId) {
        await db.collection('totp_rate_limits').doc(docId).delete().catch(function () {});
    }

    async function secretRecord(uid) {
        const snap = await db.collection('totp_secrets').doc(uid).get();
        if (!snap.exists) return null;
        const row = snap.data() || {};
        if (row.enabled !== true) return null;
        return row;
    }

    async function requireSecondFactor(context) {
        if (!context || !context.auth || !context.auth.uid) {
            throw httpError('unauthenticated', 'Must be signed in');
        }
        const uid = context.auth.uid;
        const nowMs = currentNow();
        const [secret, userSnap, phone] = await Promise.all([
            secretRecord(uid),
            db.collection('users').doc(uid).get(),
            phoneInfo(uid),
        ]);
        const userData = userSnap.exists ? (userSnap.data() || {}) : {};
        if (secret) {
            const session = await sessionValid(uid, context.mfaSessionId || '', nowMs);
            if (!session) throw httpError('failed-precondition', 'Authenticator session required');
        }
        const phoneMust = phone.enrolled === true || (phone.missing === true && userData.phoneVerified === true);
        if (phoneMust) {
            const token = (context.auth.token && context.auth.token.firebase) || {};
            if (!token.sign_in_second_factor) {
                throw httpError('failed-precondition', 'Sign in again so your phone verification applies.');
            }
        }
        return { uid: uid, totp: !!secret, phone: phone.enrolled === true };
    }

    async function assertTotpKey() {
        if (!encryptionKeyConfigured()) {
            throw httpError('failed-precondition', 'Authenticator setup is unavailable right now.');
        }
    }

    async function readPlainSecret(row) {
        try {
            return decryptTotpSecret({ enc: row.secretEnc === true, value: row.secret });
        } catch (e) {
            if (e && e.code === 'missing-key') {
                throw httpError('failed-precondition', 'Authenticator is temporarily unavailable.');
            }
            throw httpError('failed-precondition', 'Authenticator is temporarily unavailable.');
        }
    }

    function guessWindow(row, nowMs) {
        let ws = 0;
        if (row && typeof row.windowStartMs === 'number') ws = row.windowStartMs;
        else if (row && row.windowStart && row.windowStart.toDate) ws = row.windowStart.toDate().getTime();
        if (ws && (nowMs - ws) < RATE_WINDOW_MS) return { attempts: row.attempts || 0, windowStart: ws };
        return { attempts: 0, windowStart: nowMs };
    }

    function guessDay(row, nowMs) {
        let ws = 0;
        if (row && typeof row.failedWindowStartMs === 'number') ws = row.failedWindowStartMs;
        if (ws && (nowMs - ws) < DAILY_WINDOW_MS) return { failed: row.failedAttempts || 0, windowStart: ws };
        return { failed: 0, windowStart: nowMs };
    }

    function guessDayRef(uid) {
        return db.collection('totp_rate_limits').doc(uid + '_day');
    }

    function writeGuessWindow(tx, ref, attempts, windowStart, uid) {
        tx.set(ref, {
            uid: uid,
            attempts: attempts,
            windowStartMs: windowStart,
            expireAt: new Date(windowStart + RATE_WINDOW_MS),
        });
    }

    function writeGuessDay(tx, ref, failed, failStart, uid) {
        tx.set(ref, {
            uid: uid,
            failedAttempts: failed,
            failedWindowStartMs: failStart,
            expireAt: new Date(failStart + DAILY_WINDOW_MS),
        });
    }

    // One bucket per user for every authenticator guess and device resume.
    // Five tries in two minutes live on {uid}. Twenty failures in a day live
    // on {uid}_day, whose expireAt is a full day so the lobby sweeper can
    // delete the short window without wiping the daily count.
    async function chargeTotpGuess(uid, nowMs) {
        const ref = db.collection('totp_rate_limits').doc(uid);
        const dayRef = guessDayRef(uid);
        const result = await db.runTransaction(async function (tx) {
            const snap = await tx.get(ref);
            const daySnap = await tx.get(dayRef);
            const row = snap.exists ? (snap.data() || {}) : {};
            const dayRow = daySnap.exists ? (daySnap.data() || {}) : {};
            const day = guessDay(dayRow, nowMs);
            const win = guessWindow(row, nowMs);
            if (day.failed >= DAILY_FAIL_MAX) return { limited: 'day' };
            if (win.attempts >= RATE_MAX) return { limited: 'window' };
            writeGuessWindow(tx, ref, win.attempts + 1, win.windowStart, uid);
            return { limited: '' };
        });
        if (result.limited === 'day') throw httpError('resource-exhausted', 'Too many attempts. Try again tomorrow.');
        if (result.limited) throw httpError('resource-exhausted', 'Too many attempts. Wait 2 minutes.');
    }

    async function recordTotpGuessFailure(uid, nowMs) {
        const ref = guessDayRef(uid);
        await db.runTransaction(async function (tx) {
            const snap = await tx.get(ref);
            const row = snap.exists ? (snap.data() || {}) : {};
            const day = guessDay(row, nowMs);
            writeGuessDay(tx, ref, day.failed + 1, day.windowStart, uid);
        });
    }

    async function clearTotpGuessWindow(uid, nowMs) {
        const ref = db.collection('totp_rate_limits').doc(uid);
        await db.runTransaction(async function (tx) {
            const snap = await tx.get(ref);
            writeGuessWindow(tx, ref, 0, nowMs, uid);
        });
    }

    async function clearTotpGuessDay(uid) {
        await guessDayRef(uid).delete().catch(function () {});
    }

    async function passwordBoundaryMs(uid) {
        let user = null;
        try { user = await admin.auth().getUser(uid); } catch (e) { user = null; }
        if (!user) return null;
        const passwordAt = parseAuthTimeMs(user.passwordUpdatedAt)
            || parseAuthTimeMs(user.metadata && user.metadata.passwordUpdatedAt);
        if (passwordAt) return passwordAt;
        const tokensAt = parseAuthTimeMs(user.tokensValidAfterTime);
        const createdAt = parseAuthTimeMs(user.metadata && user.metadata.creationTime);
        // Signup sets this to the account's creation time. A later password
        // change or reset email moves it forward. Ignore the creation stamp.
        if (tokensAt && createdAt && tokensAt <= createdAt + 1000) return 0;
        return tokensAt;
    }

    async function acceptTotp(uid, token, nowMs) {
        await chargeTotpGuess(uid, nowMs);
        const ref = db.collection('totp_secrets').doc(uid);
        const outcome = await db.runTransaction(async function (tx) {
            const snap = await tx.get(ref);
            if (!snap.exists || !(snap.data() || {}).enabled) return { error: 'not-found' };
            const row = snap.data() || {};
            let secret;
            try {
                secret = decryptTotpSecret({ enc: row.secretEnc === true, value: row.secret });
            } catch (e) {
                return { error: 'unavailable' };
            }
            const delta = totpDelta(authenticator, token, secret, nowMs);
            if (delta === null) return { error: 'invalid' };
            const step = Math.floor(nowMs / STEP_MS) + delta;
            if (typeof row.lastAcceptedStep === 'number' && step <= row.lastAcceptedStep) return { error: 'replay' };
            tx.update(ref, { lastAcceptedStep: step });
            return { ok: true, step: step };
        });
        if (outcome.error === 'invalid' || outcome.error === 'replay') await recordTotpGuessFailure(uid, nowMs);
        if (outcome.error === 'not-found') throw httpError('not-found', 'TOTP not enabled');
        if (outcome.error === 'unavailable') throw httpError('failed-precondition', 'Authenticator is temporarily unavailable.');
        if (outcome.error === 'replay') throw httpError('invalid-argument', 'This code was already used. Wait for the next one.');
        if (outcome.error === 'invalid') throw httpError('invalid-argument', 'Invalid code');
        await clearTotpGuessWindow(uid, nowMs);
        await clearTotpGuessDay(uid);
        return outcome;
    }

    async function storeRecoveryCodes(uid, factor) {
        const made = generateRecoveryCodes();
        await db.collection('recovery_codes').doc(uid).set({
            uid: uid,
            factor: factor,
            codes: made.records,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return made.plain;
    }

    async function needsCodes(uid) {
        const snap = await db.collection('recovery_codes').doc(uid).get();
        return !snap.exists;
    }

    async function notifyUser(uid, message) {
        await db.collection('notifications').doc().set({
            recipientId: uid,
            senderId: 'system',
            senderName: 'Bitcoin Quest',
            type: 'security',
            message: message,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }

    async function notifyAdmin(row) {
        await db.collection('admin_notifications').add(Object.assign({
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, row));
    }

    async function clearTotp(uid) {
        await revokeSessions(uid, null);
        await revokeTrustedDevices(uid, '');
        await db.collection('totp_secrets').doc(uid).delete().catch(function () {});
        await db.collection('totp_pending').doc(uid).delete().catch(function () {});
        await db.collection('users').doc(uid).set({ totpEnabled: false }, { merge: true });
    }

    async function unenrollPhone(uid) {
        forgetPhone(uid);
        try {
            const rec = await admin.auth().getUser(uid);
            const factors = (rec.multiFactor && rec.multiFactor.enrolledFactors) || [];
            if (!factors.length) {
                await db.collection('users').doc(uid).set({ phoneVerified: false }, { merge: true });
                return true;
            }
            await admin.auth().updateUser(uid, { multiFactor: { enrolledFactors: null } });
            await db.collection('users').doc(uid).set({ phoneVerified: false }, { merge: true });
            forgetPhone(uid);
            return true;
        } catch (e) {
            return false;
        }
    }

    async function factorStillOn(uid) {
        const secret = await secretRecord(uid);
        const phone = await phoneInfo(uid);
        return { totp: !!secret, phone: phone.enrolled === true };
    }

    function requireUser(context) {
        if (!context || !context.auth || !context.auth.uid) throw httpError('unauthenticated', 'Must be signed in');
        return context.auth.uid;
    }

    function rejectAnonymous(context) {
        if (isAnon(context)) {
            throw httpError('permission-denied', 'Create an account before using an authenticator.');
        }
    }

    async function proveCurrentFactor(data, context, uid, nowMs) {
        const session = await sessionValid(uid, (data && data.mfaSessionId) || (context && context.mfaSessionId) || '', nowMs);
        if (session) return 'session';
        const token = (context.auth.token && context.auth.token.firebase) || {};
        if (token.sign_in_second_factor) return 'phone';
        if (data && data.code) {
            await acceptTotp(uid, String(data.code).trim(), nowMs);
            return 'totp';
        }
        throw httpError('failed-precondition', 'Enter a current authenticator code or sign in with your phone verification.');
    }

    const totpSetup = onCallWithKey(async function (data, context) {
        requireUser(context);
        rejectAnonymous(context);
        await assertTotpKey();
        const uid = context.auth.uid;
        if (await secretRecord(uid)) throw httpError('already-exists', 'Authenticator is already on.');
        const email = (context.auth.token && context.auth.token.email) || 'user';
        const secret = authenticator.generateSecret();
        const encPending = encryptTotpSecret(secret);
        await db.collection('totp_pending').doc(uid).set({
            secretEnc: true,
            secret: encPending.value,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const otpauth = authenticator.keyuri(email, 'Bitcoin Education Archive', secret);
        const qrDataUrl = await QRCode.toDataURL(otpauth);
        return { qr: qrDataUrl, secret: secret };
    });

    const totpVerify = onCallWithKey(async function (data, context) {
        const uid = requireUser(context);
        rejectAnonymous(context);
        if (!data || !data.code) throw httpError('invalid-argument', 'Code required');
        await assertTotpKey();
        const nowMs = currentNow();
        await chargeTotpGuess(uid, nowMs);
        const pending = await db.collection('totp_pending').doc(uid).get();
        if (!pending.exists) throw httpError('not-found', 'No pending TOTP setup. Start setup first.');
        const row = pending.data() || {};
        const secret = await readPlainSecret(row);
        const delta = totpDelta(authenticator, String(data.code).trim(), secret, nowMs);
        if (delta === null) {
            await recordTotpGuessFailure(uid, nowMs);
            throw httpError('invalid-argument', 'Invalid code. Try again.');
        }
        const step = Math.floor(nowMs / STEP_MS) + delta;
        const encSecret = encryptTotpSecret(secret);
        await db.collection('totp_secrets').doc(uid).set({
            secretEnc: true,
            secret: encSecret.value,
            enabled: true,
            enabledAt: admin.firestore.FieldValue.serverTimestamp(),
            lastAcceptedStep: step,
        });
        await db.collection('users').doc(uid).set({ totpEnabled: true }, { merge: true });
        try { await require('./badgeCredit').grantIds(db, admin, uid, ['totp_enabled']); }
        catch (e) { console.warn('[totpVerify] badge', e.message); }
        await db.collection('totp_pending').doc(uid).delete().catch(function () {});
        await clearTotpGuessWindow(uid, nowMs);
        await clearTotpGuessDay(uid);
        const recoveryCodes = await storeRecoveryCodes(uid, 'totp');
        const session = await issueSession(uid, nowMs);
        return {
            success: true,
            sessionId: session.sessionId,
            expiresAt: session.expiresAtMs,
            recoveryCodes: recoveryCodes,
        };
    });

    const totpCheck = onCallWithKey(async function (data, context) {
        const uid = requireUser(context);
        if (!data || !data.code) throw httpError('invalid-argument', 'Code required');
        const nowMs = currentNow();
        await acceptTotp(uid, String(data.code).trim(), nowMs);
        const session = await issueSession(uid, nowMs);
        let deviceToken = null;
        if (data.rememberDevice === true) {
            const previous = typeof data.previousDeviceToken === 'string' ? data.previousDeviceToken.trim() : '';
            deviceToken = await issueTrustedDevice(uid, nowMs, context, previous);
        }
        let recoveryCodes = null;
        if (await needsCodes(uid)) recoveryCodes = await storeRecoveryCodes(uid, 'totp');
        const body = { success: true, sessionId: session.sessionId, expiresAt: session.expiresAtMs };
        if (deviceToken) body.deviceToken = deviceToken;
        if (recoveryCodes) body.recoveryCodes = recoveryCodes;
        return body;
    });

    const totpDisable = onCallWithKey(async function (data, context) {
        const uid = requireUser(context);
        rejectAnonymous(context);
        const nowMs = currentNow();
        const proofId = data && typeof data.freshProofId === 'string' ? data.freshProofId : '';
        const hasCode = !!(data && data.code && /^\d{6}$/.test(String(data.code).trim()));
        if (!hasCode && !/^[a-f0-9]{32}$/.test(proofId)) {
            throw httpError('failed-precondition', 'Enter a fresh authenticator code for this action.');
        }
        await proveFreshCode(data, context, uid, 'disableTotp', nowMs);
        await clearTotp(uid);
        forgetPhone(uid);
        const phone = await phoneInfo(uid);
        if (phone.enrolled !== true) {
            await db.collection('recovery_codes').doc(uid).delete().catch(function () {});
        }
        return { success: true };
    });

    const totpStatus = functionsV1.https.onCall(async function (data, context) {
        const uid = requireUser(context);
        forgetPhone(uid);
        const nowMs = currentNow();
        const sessionId = data && typeof data.sessionId === 'string' ? data.sessionId : '';
        const [secret, session, codes, phone, userSnap] = await Promise.all([
            secretRecord(uid),
            sessionValid(uid, sessionId, nowMs),
            db.collection('recovery_codes').doc(uid).get(),
            phoneInfo(uid),
            db.collection('users').doc(uid).get(),
        ]);
        const userData = userSnap.exists ? (userSnap.data() || {}) : {};
        const phoneOn = phone.enrolled === true;
        const enabled = !!secret;
        return {
            enabled: enabled,
            phoneEnabled: phoneOn || userData.phoneVerified === true,
            sessionVerified: !!session,
            needsRecoveryCodes: (enabled || phoneOn) && !codes.exists,
            expiresAt: session ? session.expiresAtMs : null,
        };
    });

    const totpRevokeSession = functionsV1.https.onCall(async function (data, context) {
        const uid = requireUser(context);
        const sessionId = data && typeof data.sessionId === 'string' ? data.sessionId : '';
        if (data && data.all === true) await revokeSessions(uid, null);
        else if (/^[a-f0-9]{64}$/.test(sessionId)) await revokeSessions(uid, sessionId);
        return { success: true };
    });

    const issueRecoveryCodes = functionsV1.https.onCall(async function (data, context) {
        const uid = requireUser(context);
        if (isAnon(context)) throw httpError('permission-denied', 'Sign in before saving recovery codes.');
        forgetPhone(uid);
        const nowMs = currentNow();
        const existing = await db.collection('recovery_codes').doc(uid).get();
        if (existing.exists) return { already: true };
        const secret = await secretRecord(uid);
        const phone = await phoneInfo(uid);
        const session = await sessionValid(uid, (data && data.mfaSessionId) || '', nowMs);
        const token = (context.auth.token && context.auth.token.firebase) || {};
        const freshPhone = phone.enrolled === true && phone.enrollmentTime && (nowMs - phone.enrollmentTime) < 20 * 60 * 1000;
        if (!secret && phone.enrolled !== true) {
            throw httpError('failed-precondition', 'Turn on two-factor authentication first.');
        }
        if (!session && !token.sign_in_second_factor && !freshPhone) {
            throw httpError('failed-precondition', 'Confirm your authenticator or phone before saving recovery codes.');
        }
        const factor = secret && phone.enrolled ? 'both' : (secret ? 'totp' : 'phone');
        const recoveryCodes = await storeRecoveryCodes(uid, factor);
        if (phone.enrolled) await db.collection('users').doc(uid).set({ phoneVerified: true }, { merge: true });
        return { success: true, recoveryCodes: recoveryCodes };
    });

    const regenerateRecoveryCodes = onCallWithKey(async function (data, context) {
        const uid = requireUser(context);
        stamp(data, context);
        const nowMs = currentNow();
        const how = await proveFreshCode(data, context, uid, 'regenerateRecoveryCodes', nowMs);
        const secret = await secretRecord(uid);
        const phone = await phoneInfo(uid);
        if (!secret && phone.enrolled !== true) throw httpError('failed-precondition', 'Two-factor authentication is off.');
        const factor = secret && phone.enrolled ? 'both' : (secret ? 'totp' : 'phone');
        const recoveryCodes = await storeRecoveryCodes(uid, factor);
        return { success: true, recoveryCodes: recoveryCodes, proved: how };
    });

    async function lookupEmailUid(email) {
        try {
            const rec = await admin.auth().getUserByEmail(email);
            return rec && rec.uid ? rec.uid : null;
        } catch (e) {
            return null;
        }
    }

    const useRecoveryCode = functionsV1.https.onCall(async function (data, context) {
        const nowMs = currentNow();
        const email = String((data && data.email) || '').trim().toLowerCase();
        const normalized = normalizeRecoveryCode(data && data.code);
        if (normalized.length !== 8) throw httpError('invalid-argument', 'Enter a recovery code.');
        let uid = null;
        if (email) uid = await lookupEmailUid(email);
        else if (context && context.auth && !isAnon(context)) uid = context.auth.uid;
        else throw httpError('invalid-argument', 'Enter the email on the account and a recovery code.');
        const ip = faucetGuard.clientIpFromRequest(context && context.rawRequest) || 'unknown';
        const recoverDocId = await networkRateDocId(db, 'recover_', email || uid || 'none', nowMs);
        await takeAttempt(recoverDocId, nowMs);
        const ipDocId = await networkRateDocId(db, 'recoverip_', ip, nowMs);
        await takeNetworkAttempt(ipDocId, nowMs);
        hashRecoveryCode(normalized, Buffer.alloc(16, 7));
        if (!uid) throw httpError('invalid-argument', 'Invalid recovery code');
        const ref = db.collection('recovery_codes').doc(uid);
        const snap = await ref.get();
        const matched = snap.exists ? codeMatches((snap.data() || {}).codes, normalized) : -1;
        if (matched < 0) throw httpError('invalid-argument', 'Invalid recovery code');
        const phoneCleared = await unenrollPhone(uid);
        if (!phoneCleared) {
            throw httpError('failed-precondition', 'Could not turn off phone verification. Try the code again.');
        }
        const consumed = await db.runTransaction(async function (tx) {
            const fresh = await tx.get(ref);
            if (!fresh.exists) return false;
            const again = codeMatches((fresh.data() || {}).codes, normalized);
            if (again < 0) return false;
            tx.delete(ref);
            return true;
        });
        if (!consumed) throw httpError('invalid-argument', 'Invalid recovery code');
        await clearTotp(uid);
        await clearTotpGuessDay(uid);
        await db.collection('users').doc(uid).set({ totpEnabled: false, phoneVerified: false }, { merge: true });
        forgetPhone(uid);
        await clearAttempt(recoverDocId);
        await db.collection('rate_limits').doc(ipDocId).delete().catch(function () {});
        const message = 'Two-factor authentication was turned off with a recovery code. If this was not you, contact support.';
        await notifyUser(uid, message);
        await notifyAdmin({
            type: 'mfa_recovery',
            uid: uid,
            phoneCleared: phoneCleared,
            message: 'A recovery code turned off two-factor authentication.',
        });
        await db.collection('mfa_admin_log').add({
            action: 'recovery_code',
            targetUid: uid,
            phoneCleared: phoneCleared,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true, disabled: true, phoneCleared: phoneCleared };
    });

    // App Check matches the other sensitive callables. The handler does not
    // trust a session or a device token. Rate limit is per uid.
    const onCallApp = functionsV1.runWith({ enforceAppCheck: true }).https.onCall;
    const onCallAppKey = functionsV1.runWith({
        secrets: ['TOTP_ENCRYPTION_KEY'],
        enforceAppCheck: true,
    }).https.onCall;

    const totpResumeDevice = onCallApp(async function (data, context) {
        const uid = requireUser(context);
        const nowMs = currentNow();
        await chargeTotpGuess(uid, nowMs);
        const secret = await secretRecord(uid);
        if (!secret) {
            await recordTotpGuessFailure(uid, nowMs);
            throw httpError('failed-precondition', 'Device is not trusted.');
        }
        const token = data && typeof data.deviceToken === 'string' ? data.deviceToken.trim() : '';
        const found = await deviceByToken(token);
        if (!found) {
            await recordTotpGuessFailure(uid, nowMs);
            throw httpError('failed-precondition', 'Device is not trusted.');
        }
        if (found.row.uid !== uid) {
            await recordTotpGuessFailure(uid, nowMs);
            throw httpError('permission-denied', 'Device is not trusted.');
        }
        if (found.row.revoked === true) {
            await recordTotpGuessFailure(uid, nowMs);
            throw httpError('failed-precondition', 'Device is not trusted.');
        }
        if (!(typeof found.row.expiresAtMs === 'number' && found.row.expiresAtMs > nowMs)) {
            await recordTotpGuessFailure(uid, nowMs);
            throw httpError('failed-precondition', 'Device is not trusted.');
        }
        const boundary = await passwordBoundaryMs(uid);
        const createdAtMs = typeof found.row.createdAtMs === 'number' ? found.row.createdAtMs : 0;
        if (boundary == null || (boundary > 0 && createdAtMs < boundary)) {
            if (boundary != null) await found.ref.update({ revoked: true, revokedAtMs: nowMs }).catch(function () {});
            await recordTotpGuessFailure(uid, nowMs);
            throw httpError('failed-precondition', 'Device is not trusted.');
        }
        const expiresAtMs = found.row.expiresAtMs;
        const accepted = await db.runTransaction(async function (tx) {
            const fresh = await tx.get(found.ref);
            if (!fresh.exists) return false;
            const row = fresh.data() || {};
            if (row.uid !== uid || row.revoked === true) return false;
            if (row.tokenHash !== found.tokenHash) return false;
            if (!(typeof row.expiresAtMs === 'number' && row.expiresAtMs > nowMs)) return false;
            if (row.expiresAtMs !== expiresAtMs) return false;
            tx.update(found.ref, {
                lastUsedAtMs: nowMs,
                lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return true;
        });
        if (!accepted) {
            await recordTotpGuessFailure(uid, nowMs);
            throw httpError('failed-precondition', 'Device is not trusted.');
        }
        const session = await issueSession(uid, nowMs);
        await clearTotpGuessWindow(uid, nowMs);
        return { success: true, sessionId: session.sessionId, expiresAt: session.expiresAtMs };
    });

    const totpStepUp = onCallAppKey(async function (data, context) {
        const uid = requireUser(context);
        const action = String((data && data.action) || '');
        if (!FRESH_ACTIONS[action]) throw httpError('invalid-argument', 'Unknown action');
        if (!data || !data.code) throw httpError('invalid-argument', 'Code required');
        const nowMs = currentNow();
        await acceptTotp(uid, String(data.code).trim(), nowMs);
        const proof = await issueFreshProof(uid, action, nowMs);
        return { success: true, action: action, freshProofId: proof.proofId, expiresAt: proof.expiresAtMs };
    });

    const totpListDevices = onCallApp(async function (data, context) {
        const uid = requireUser(context);
        const nowMs = currentNow();
        const token = data && typeof data.deviceToken === 'string' ? data.deviceToken.trim() : '';
        const currentHash = hashDeviceToken(token);
        const snap = await db.collection('trusted_devices').where('uid', '==', uid).get();
        const devices = [];
        snap.forEach(function (doc) {
            const row = doc.data() || {};
            if (row.revoked === true) return;
            if (!(typeof row.expiresAtMs === 'number' && row.expiresAtMs > nowMs)) return;
            devices.push({
                id: doc.id,
                label: typeof row.label === 'string' ? row.label : 'Browser',
                createdAtMs: row.createdAtMs || 0,
                lastUsedAtMs: row.lastUsedAtMs || 0,
                expiresAtMs: row.expiresAtMs,
                current: !!(currentHash && row.tokenHash === currentHash),
            });
        });
        return { devices: devices };
    });

    const totpRevokeDevice = onCallApp(async function (data, context) {
        const uid = requireUser(context);
        const nowMs = currentNow();
        const token = data && typeof data.deviceToken === 'string' ? data.deviceToken.trim() : '';
        if (/^[0-9a-f]{64}$/.test(token)) {
            const found = await deviceByToken(token);
            if (!found || found.row.uid !== uid) throw httpError('permission-denied', 'Device is not trusted.');
            await found.ref.update({ revoked: true, revokedAtMs: nowMs });
            return { success: true };
        }
        const deviceId = data && typeof data.deviceId === 'string' ? data.deviceId.trim() : '';
        if (!/^[a-f0-9]{32}$/.test(deviceId)) throw httpError('invalid-argument', 'Device is not trusted.');
        const snap = await db.collection('trusted_devices').doc(deviceId).get();
        if (!snap.exists || (snap.data() || {}).uid !== uid) throw httpError('permission-denied', 'Device is not trusted.');
        await snap.ref.update({ revoked: true, revokedAtMs: nowMs });
        return { success: true };
    });

    const totpSignOutOtherDevices = onCallApp(async function (data, context) {
        const uid = requireUser(context);
        const nowMs = currentNow();
        const token = data && typeof data.deviceToken === 'string' ? data.deviceToken.trim() : '';
        let exceptHash = '';
        if (/^[0-9a-f]{64}$/.test(token)) {
            const found = await deviceByToken(token);
            if (found && found.row.uid === uid && found.row.revoked !== true && found.row.expiresAtMs > nowMs) {
                exceptHash = found.tokenHash;
            }
        }
        const sessionId = data && typeof data.mfaSessionId === 'string' ? data.mfaSessionId : '';
        let keepSession = '';
        if (/^[a-f0-9]{64}$/.test(sessionId)) {
            const session = await sessionValid(uid, sessionId, nowMs);
            if (session) keepSession = sessionId;
        }
        await revokeTrustedDevices(uid, exceptHash);
        await revokeOtherSessions(uid, keepSession);
        return { success: true };
    });

    // No Firebase Auth blocking hook exists for password or email changes.
    // The password-reset email control calls this and drops every device and session.
    const totpRevokeAllTrust = onCallApp(async function (data, context) {
        const uid = requireUser(context);
        await revokeTrustedDevices(uid, '');
        await revokeSessions(uid, null);
        return { success: true };
    });

    const phoneFactorRemoved = functionsV1.https.onCall(async function (data, context) {
        const uid = requireUser(context);
        forgetPhone(uid);
        const phone = await phoneInfo(uid);
        if (phone.enrolled === true) throw httpError('failed-precondition', 'Phone verification is still on.');
        await db.collection('users').doc(uid).set({ phoneVerified: false }, { merge: true });
        const secret = await secretRecord(uid);
        if (!secret) await db.collection('recovery_codes').doc(uid).delete().catch(function () {});
        return { success: true };
    });

    const adminResetSecondFactor = functionsV1.https.onCall(async function (data, context) {
        if (!context || !context.auth || !context.auth.token || context.auth.token.admin !== true) {
            throw httpError('permission-denied', 'Admin only.');
        }
        const targetUid = String((data && data.uid) || '').trim();
        const note = String((data && data.note) || '').trim().slice(0, 500);
        if (!/^[A-Za-z0-9]{6,128}$/.test(targetUid)) throw httpError('invalid-argument', 'Enter the account id.');
        if (note.length < 8) throw httpError('invalid-argument', 'Describe how you verified this person.');
        const phoneCleared = await unenrollPhone(targetUid);
        if (!phoneCleared) {
            throw httpError('failed-precondition', 'Could not turn off phone verification. Try again.');
        }
        await clearTotp(targetUid);
        await db.collection('recovery_codes').doc(targetUid).delete().catch(function () {});
        await db.collection('users').doc(targetUid).set({ totpEnabled: false, phoneVerified: false }, { merge: true });
        forgetPhone(targetUid);
        await db.collection('mfa_admin_log').add({
            action: 'admin_reset',
            targetUid: targetUid,
            adminUid: context.auth.uid,
            note: note,
            phoneCleared: phoneCleared,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await notifyAdmin({
            type: 'mfa_admin_reset',
            uid: targetUid,
            adminUid: context.auth.uid,
            message: 'An admin turned off two-factor authentication after a manual check.',
        });
        await notifyUser(targetUid, 'Two-factor authentication was turned off by support after they verified it was you. You can turn it on again in Settings.');
        return { success: true };
    });

    const api = {
        stamp: stamp,
        requireSecondFactor: requireSecondFactor,
        totpSetup: totpSetup,
        totpVerify: totpVerify,
        totpCheck: totpCheck,
        totpDisable: totpDisable,
        totpStatus: totpStatus,
        totpRevokeSession: totpRevokeSession,
        totpResumeDevice: totpResumeDevice,
        totpStepUp: totpStepUp,
        totpListDevices: totpListDevices,
        totpRevokeDevice: totpRevokeDevice,
        totpSignOutOtherDevices: totpSignOutOtherDevices,
        totpRevokeAllTrust: totpRevokeAllTrust,
        requireFreshStepUp: requireFreshStepUp,
        issueRecoveryCodes: issueRecoveryCodes,
        regenerateRecoveryCodes: regenerateRecoveryCodes,
        useRecoveryCode: useRecoveryCode,
        phoneFactorRemoved: phoneFactorRemoved,
        adminResetSecondFactor: adminResetSecondFactor,
        forgetPhone: forgetPhone,
        factorStillOn: factorStillOn,
    };
    singleton = api;
    return api;
}

function requireReady() {
    if (!singleton) throw new Error('second factor not initialized');
    return singleton;
}

function stamp(data, context) {
    return requireReady().stamp(data, context);
}

function requireSecondFactor(context) {
    return requireReady().requireSecondFactor(context);
}

function requireFreshStepUp(context, action) {
    return requireReady().requireFreshStepUp(context, action);
}

// Same delete the scheduled lobby cleanup runs. nowDate is the cutoff so a
// test can sweep a two-minute window without waiting out the day counter.
async function sweepExpiredMfaRows(db, nowDate) {
    const cutoff = nowDate instanceof Date ? nowDate : new Date(nowDate);
    const expiredSessions = await db.collection('totp_sessions').where('expireAt', '<', cutoff).limit(200).get();
    if (!expiredSessions.empty) {
        const sessionBatch = db.batch();
        expiredSessions.docs.forEach(function (doc) { sessionBatch.delete(doc.ref); });
        await sessionBatch.commit();
    }
    const expiredAttempts = await db.collection('totp_rate_limits').where('expireAt', '<', cutoff).limit(200).get();
    if (!expiredAttempts.empty) {
        const attemptBatch = db.batch();
        expiredAttempts.docs.forEach(function (doc) { attemptBatch.delete(doc.ref); });
        await attemptBatch.commit();
    }
    return { sessions: expiredSessions.size, attempts: expiredAttempts.size };
}

module.exports = {
    initSecondFactor: initSecondFactor,
    sweepExpiredMfaRows: sweepExpiredMfaRows,
    stamp: stamp,
    requireSecondFactor: requireSecondFactor,
    requireFreshStepUp: requireFreshStepUp,
    encryptTotpSecret: encryptTotpSecret,
    decryptTotpSecret: decryptTotpSecret,
    encryptionKeyConfigured: encryptionKeyConfigured,
    migratePlaintextSecrets: migratePlaintextSecrets,
    normalizeRecoveryCode: normalizeRecoveryCode,
    hashRecoveryCode: hashRecoveryCode,
    SESSION_TTL_MS: SESSION_TTL_MS,
    DEVICE_TTL_MS: DEVICE_TTL_MS,
    FRESH_TTL_MS: FRESH_TTL_MS,
    DAILY_FAIL_MAX: DAILY_FAIL_MAX,
    MAX_TRUSTED_DEVICES: MAX_TRUSTED_DEVICES,
    deviceLabel: deviceLabel,
    hashDeviceToken: hashDeviceToken,
};
