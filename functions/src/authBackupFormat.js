'use strict';

// JSONL shape inside the gzip that gets encrypted.
// Line 1 is a header (hash config lives only here, never in the public manifest).
// Each following line is one Auth user.

const HEADER_TYPE = 'auth-export-v1';

function readMetadata(meta) {
    if (!meta) return { creationTime: null, lastSignInTime: null, lastRefreshTime: null };
    const json = typeof meta.toJSON === 'function' ? meta.toJSON() : meta;
    return {
        creationTime: json.creationTime || null,
        lastSignInTime: json.lastSignInTime || null,
        lastRefreshTime: json.lastRefreshTime || null,
    };
}

function serializeAuthUser(user) {
    const json = user && typeof user.toJSON === 'function' ? user.toJSON() : (user || {});
    const providers = Array.isArray(json.providerData) ? json.providerData : [];
    const out = {
        uid: json.uid,
        email: json.email || null,
        emailVerified: json.emailVerified === true,
        displayName: json.displayName || null,
        photoURL: json.photoURL || null,
        phoneNumber: json.phoneNumber || null,
        disabled: json.disabled === true,
        metadata: readMetadata(json.metadata),
        providerData: providers.map((p) => ({
            uid: p.uid || null,
            providerId: p.providerId || null,
            displayName: p.displayName || null,
            email: p.email || null,
            photoURL: p.photoURL || null,
            phoneNumber: p.phoneNumber || null,
        })),
        customClaims: json.customClaims || null,
        tokensValidAfterTime: json.tokensValidAfterTime || null,
    };
    if (json.tenantId) out.tenantId = json.tenantId;
    if (json.passwordHash) out.passwordHash = String(json.passwordHash);
    if (json.passwordSalt) out.passwordSalt = String(json.passwordSalt);
    const factors = json.multiFactor && Array.isArray(json.multiFactor.enrolledFactors)
        ? json.multiFactor.enrolledFactors
        : [];
    if (factors.length) {
        out.multiFactor = {
            enrolledFactors: factors.map((f) => ({
                uid: f.uid || null,
                factorId: f.factorId || null,
                displayName: f.displayName || null,
                enrollmentTime: f.enrollmentTime || null,
                phoneNumber: f.phoneNumber || null,
            })),
        };
    }
    return out;
}

function isAnonymousRecord(user) {
    return !user.email && !user.phoneNumber && (!user.providerData || user.providerData.length === 0);
}

function pickHashConfig(json) {
    const hc = json && json.signIn && json.signIn.hashConfig;
    if (!hc || !hc.algorithm || !hc.signerKey) return null;
    return {
        algorithm: hc.algorithm,
        signerKey: hc.signerKey,
        saltSeparator: hc.saltSeparator || '',
        rounds: hc.rounds,
        memoryCost: hc.memoryCost,
    };
}

function buildJsonl(header, users) {
    const first = Object.assign({ _bq: HEADER_TYPE }, header || {});
    const lines = [JSON.stringify(first)];
    for (let i = 0; i < users.length; i++) lines.push(JSON.stringify(users[i]));
    return lines.join('\n') + '\n';
}

function parseJsonl(text) {
    const lines = String(text || '').split('\n').filter((line) => line.length > 0);
    if (!lines.length) throw new Error('auth export is empty');
    const header = JSON.parse(lines[0]);
    if (!header || header._bq !== HEADER_TYPE) throw new Error('unrecognized auth export header');
    const users = [];
    for (let i = 1; i < lines.length; i++) users.push(JSON.parse(lines[i]));
    return { header, users };
}

module.exports = {
    HEADER_TYPE,
    serializeAuthUser,
    isAnonymousRecord,
    pickHashConfig,
    buildJsonl,
    parseJsonl,
};
