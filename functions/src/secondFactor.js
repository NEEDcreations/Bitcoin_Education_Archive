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
const RATE_WINDOW_MS = 120000;
const RATE_MAX = 5;
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

    async function acceptTotp(uid, token, nowMs) {
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
        if (outcome.error === 'not-found') throw httpError('not-found', 'TOTP not enabled');
        if (outcome.error === 'unavailable') throw httpError('failed-precondition', 'Authenticator is temporarily unavailable.');
        if (outcome.error === 'replay') throw httpError('invalid-argument', 'This code was already used. Wait for the next one.');
        if (outcome.error === 'invalid') throw httpError('invalid-argument', 'Invalid code');
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
        await takeAttempt(uid + '_verify', nowMs);
        const pending = await db.collection('totp_pending').doc(uid).get();
        if (!pending.exists) throw httpError('not-found', 'No pending TOTP setup. Start setup first.');
        const row = pending.data() || {};
        const secret = await readPlainSecret(row);
        const delta = totpDelta(authenticator, String(data.code).trim(), secret, nowMs);
        if (delta === null) throw httpError('invalid-argument', 'Invalid code. Try again.');
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
        await clearAttempt(uid + '_verify');
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
        await takeAttempt(uid, nowMs);
        await acceptTotp(uid, String(data.code).trim(), nowMs);
        await clearAttempt(uid);
        const session = await issueSession(uid, nowMs);
        let recoveryCodes = null;
        if (await needsCodes(uid)) recoveryCodes = await storeRecoveryCodes(uid, 'totp');
        const body = { success: true, sessionId: session.sessionId, expiresAt: session.expiresAtMs };
        if (recoveryCodes) body.recoveryCodes = recoveryCodes;
        return body;
    });

    const totpDisable = onCallWithKey(async function (data, context) {
        const uid = requireUser(context);
        rejectAnonymous(context);
        if (!data || !data.code) throw httpError('invalid-argument', 'Enter your current code to disable');
        const nowMs = currentNow();
        await takeAttempt(uid + '_disable', nowMs);
        await acceptTotp(uid, String(data.code).trim(), nowMs);
        await clearAttempt(uid + '_disable');
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
        await takeAttempt(uid + '_regen', nowMs);
        const how = await proveCurrentFactor(data, context, uid, nowMs);
        await clearAttempt(uid + '_regen');
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

module.exports = {
    initSecondFactor: initSecondFactor,
    stamp: stamp,
    requireSecondFactor: requireSecondFactor,
    encryptTotpSecret: encryptTotpSecret,
    decryptTotpSecret: decryptTotpSecret,
    encryptionKeyConfigured: encryptionKeyConfigured,
    migratePlaintextSecrets: migratePlaintextSecrets,
    normalizeRecoveryCode: normalizeRecoveryCode,
    hashRecoveryCode: hashRecoveryCode,
    SESSION_TTL_MS: SESSION_TTL_MS,
};
