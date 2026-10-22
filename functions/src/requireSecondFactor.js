'use strict';

// Shared second-factor gate. A later 2FA change can replace this file.
// Phone MFA is enforced by Firebase before auth_time, so this only checks
// the app authenticator. Admin actions pass skip: true.

function verifiedAtMs(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value && typeof value.toMillis === 'function') return value.toMillis();
    if (value && typeof value.toDate === 'function') {
        const date = value.toDate();
        return date && typeof date.getTime === 'function' ? date.getTime() : 0;
    }
    if (value instanceof Date) return value.getTime();
    return 0;
}

async function requireSecondFactor(context, options) {
    const opts = options || {};
    const auth = context && context.auth;
    if (!auth || !auth.uid) {
        return { ok: false, code: 'unauthenticated', message: 'Sign in required.' };
    }
    if (opts.skip) return { ok: true };
    const db = opts.db;
    if (!db || typeof db.collection !== 'function') {
        throw new Error('Second factor storage is required');
    }
    const secretSnap = await db.collection('totp_secrets').doc(auth.uid).get();
    const secret = secretSnap && secretSnap.exists ? (secretSnap.data() || {}) : null;
    if (!secret || secret.enabled !== true) return { ok: true };
    const sessionSnap = await db.collection('totp_sessions').doc(auth.uid).get();
    const session = sessionSnap && sessionSnap.exists ? (sessionSnap.data() || {}) : null;
    const authTimeSec = auth.token && Number(auth.token.auth_time);
    const authTimeMs = Number.isFinite(authTimeSec) ? authTimeSec * 1000 : 0;
    const verifiedAt = session ? verifiedAtMs(session.verifiedAt) : 0;
    if (!session || session.verified !== true || !verifiedAt || verifiedAt < authTimeMs) {
        return {
            ok: false,
            code: 'failed-precondition',
            message: 'Enter your 2FA code, then try again.',
        };
    }
    return { ok: true };
}

module.exports = {
    requireSecondFactor: requireSecondFactor,
    verifiedAtMs: verifiedAtMs,
};
