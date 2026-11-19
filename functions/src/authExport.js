'use strict';

// Daily encrypted Firebase Auth export (dailyAuthExport).
//
// 1. Reads the project's password hash config (SCRYPT signer key etc.) from
//    the Identity Toolkit admin v2 config API.
// 2. Pages admin.auth().listUsers(1000) into JSONL, keeping passwordHash and
//    passwordSalt. Line 1 is a header holding the hash config, which a
//    restore needs; it lives only inside the ciphertext.
// 3. Encrypts in memory to the age public recipient(s) in
//    authBackupConfig.js. No plaintext is written anywhere. No private key
//    or passphrase exists in the function, the bucket, or the box.
// 4. Writes gs://<project>-auth-backups/auth/<ET date>/<HHmmss>Z-<runId>.jsonl.age
//    and a matching .manifest.json (counts, ciphertext sha256, timestamps).
//    The UTC time plus a random run id makes each run unique, so a same-day
//    rerun can succeed and future names cannot be pre-created. Both use
//    ifGenerationMatch=0: create-only, never overwrite. The runtime account
//    has storage.objectCreator on that bucket only (no read/delete).
//
// Fails closed and loud: on any error, or if the export is incomplete (no
// hash config, or password users came back without hashes), it writes
// auth/<ET date>/<HHmmss>Z-<runId>.FAILED.json (no user data) and throws so
// the run is marked failed in Cloud Scheduler and logs, the same way
// dailyFirestoreBackup surfaces failures. An incomplete export is still
// uploaded (encrypted) because a partial backup beats none, but the run
// still fails.
//
// Logs counts only. Never logs emails, uids, hashes, salts, or the signer key.

const crypto = require('crypto');
const age = require('./ageEncrypt');
const cfg = require('./authBackupConfig');

const HEADER_TYPE = 'bq-auth-export-v2';
const PAGE = 1000;

function etDate(now) {
    // YYYY-MM-DD in America/New_York (en-CA formats as ISO date).
    return new Intl.DateTimeFormat('en-CA', { timeZone: cfg.TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function newRunId() {
    return crypto.randomBytes(8).toString('hex');
}

function utcStamp(now) {
    const iso = now.toISOString(); // YYYY-MM-DDTHH:MM:SS.sssZ
    return iso.slice(11, 13) + iso.slice(14, 16) + iso.slice(17, 19) + 'Z';
}

// Per-run names: auth/<ET date>/<HHmmss>Z-<16-hex-runId>.{jsonl.age,manifest.json,FAILED.json}
function objectNames(date, now, runId) {
    const stamp = utcStamp(now) + '-' + runId;
    const base = cfg.PREFIX + date + '/' + stamp;
    return {
        data: base + '.jsonl.age',
        manifest: base + '.manifest.json',
        failed: base + '.FAILED.json',
        stamp: stamp,
        runId: runId,
    };
}

function readMetadata(meta) {
    if (!meta) return { creationTime: null, lastSignInTime: null, lastRefreshTime: null };
    const json = typeof meta.toJSON === 'function' ? meta.toJSON() : meta;
    return {
        creationTime: json.creationTime || null,
        lastSignInTime: json.lastSignInTime || null,
        lastRefreshTime: json.lastRefreshTime || null,
    };
}

// Shape is close to UserImportRecord so restore is a straight map.
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
        providerData: providers.map(function (p) {
            return {
                uid: p.uid || null,
                providerId: p.providerId || null,
                displayName: p.displayName || null,
                email: p.email || null,
                photoURL: p.photoURL || null,
                phoneNumber: p.phoneNumber || null,
            };
        }),
        customClaims: json.customClaims || null,
        tokensValidAfterTime: json.tokensValidAfterTime || null,
    };
    if (json.tenantId) out.tenantId = json.tenantId;
    if (json.passwordHash) out.passwordHash = String(json.passwordHash);
    if (json.passwordSalt) out.passwordSalt = String(json.passwordSalt);
    const factors = json.multiFactor && Array.isArray(json.multiFactor.enrolledFactors) ? json.multiFactor.enrolledFactors : [];
    if (factors.length) {
        out.multiFactor = {
            enrolledFactors: factors.map(function (f) {
                return {
                    uid: f.uid || null,
                    factorId: f.factorId || null,
                    displayName: f.displayName || null,
                    enrollmentTime: f.enrollmentTime || null,
                    phoneNumber: f.phoneNumber || null,
                };
            }),
        };
    }
    return out;
}

function isPasswordUser(u) {
    return (u.providerData || []).some(function (p) { return p && p.providerId === 'password'; });
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

async function fetchHashConfig(admin, projectId, fetchImpl) {
    const token = await admin.app().options.credential.getAccessToken();
    const res = await fetchImpl('https://identitytoolkit.googleapis.com/admin/v2/projects/' + encodeURIComponent(projectId) + '/config', {
        headers: { Authorization: 'Bearer ' + token.access_token },
    });
    const json = await res.json();
    if (!res.ok || (json && json.error)) {
        const code = json && json.error ? (json.error.status || json.error.code) : res.status;
        throw new Error('hash config read failed: ' + code);
    }
    return pickHashConfig(json);
}

async function listAllUsers(auth) {
    const users = [];
    let pageToken;
    let pages = 0;
    do {
        const res = await auth.listUsers(PAGE, pageToken);
        res.users.forEach(function (u) { users.push(serializeAuthUser(u)); });
        pageToken = res.pageToken;
        pages++;
        if (pages > 100000) throw new Error('listUsers did not terminate');
    } while (pageToken);
    return users;
}

function summarize(users, hashConfig) {
    let passwordUsers = 0;
    let withHash = 0;
    let mfa = 0;
    let disabled = 0;
    users.forEach(function (u) {
        if (isPasswordUser(u)) passwordUsers++;
        if (u.passwordHash) withHash++;
        if (u.multiFactor) mfa++;
        if (u.disabled) disabled++;
    });
    const issues = [];
    if (!hashConfig) issues.push('hash config missing (runtime account needs firebaseauth.configs.get + getHashConfig)');
    if (passwordUsers > 0 && withHash < passwordUsers) {
        issues.push('password users without hash: ' + (passwordUsers - withHash) + ' of ' + passwordUsers + ' (needs firebaseauth.configs.getHashConfig)');
    }
    return { users: users.length, passwordUsers: passwordUsers, withHash: withHash, mfaUsers: mfa, disabled: disabled, issues: issues };
}

function buildJsonl(header, users) {
    const lines = [JSON.stringify(Object.assign({ _bq: HEADER_TYPE }, header))];
    for (let i = 0; i < users.length; i++) lines.push(JSON.stringify(users[i]));
    return Buffer.from(lines.join('\n') + '\n', 'utf8');
}

function sha256Hex(buf) {
    return crypto.createHash('sha256').update(buf).digest('hex');
}

// Strips anything that looks like an email, a phone number, a long token, or
// a key from an error message before it goes into a log or the FAILED marker.
// Phone rule (after email): /\+?\d[\d\s().-]{6,18}\d/ covers compact E.164,
// spaced international, and local forms like (555) 123-4567. That pattern
// would also eat ISO dates (2026-11-10), labeled counts (bytes 1234567),
// and per-run object stamps (083000Z-<16 hex>), so those are held out and
// restored. Held counts are capped at 7 digits so a phone sitting after a
// count word (e.g. "failed 5551234567" or "users: 5551234567") is not
// protected. Bare 8–20 digit strings with no label are treated as phones
// (needed for 5551234567).
const PHONE_RE = /\+?\d[\d\s().-]{6,18}\d/g;
const SANITIZE_DATE_RE = /\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?/g;
const SANITIZE_COUNT_RE = /\b(?:users|userCount|passwordUsers|withHash|withPasswordHash|mfaUsers|disabled(?:Users)?|bytes|ciphertextBytes|plaintextBytes|jsonlLines|lines|unique uids|imported|failed|deleted|found(?: after import)?)\s*:?\s*\d{1,7}\b/gi;
const SANITIZE_STAMP_RE = /\b\d{6}Z-[0-9a-f]{16}\b/gi;

function holdMatches(s, re, stash) {
    return s.replace(re, function (m) {
        stash.push(m);
        return '\u0000H' + (stash.length - 1) + '\u0000';
    });
}

function sanitize(msg) {
    const stash = [];
    let s = String(msg || 'error').replace(/[^\s@]+@[^\s@]+/g, '<email>');
    s = holdMatches(s, SANITIZE_DATE_RE, stash);
    s = holdMatches(s, SANITIZE_COUNT_RE, stash);
    s = holdMatches(s, SANITIZE_STAMP_RE, stash);
    s = s.replace(PHONE_RE, '<phone>');
    s = s.replace(/AGE-SECRET-KEY-1[0-9A-Z]+/gi, '<redacted>');
    s = s.replace(/[A-Za-z0-9+/_=-]{24,}/g, '<redacted>');
    s = s.replace(/\u0000H(\d+)\u0000/g, function (_, i) { return stash[Number(i)]; });
    return s.slice(0, 300);
}

async function save(bucket, name, body, contentType) {
    await bucket.file(name).save(body, {
        resumable: false,
        contentType: contentType,
        preconditionOpts: { ifGenerationMatch: 0 },
        metadata: { cacheControl: 'no-store' },
    });
}

// deps: { auth, bucket, recipients, projectId, now, getHashConfig, log }
async function runAuthExport(deps) {
    const log = deps.log || console;
    const now = deps.now || new Date();
    const date = etDate(now);
    const runId = deps.runId || newRunId();
    const names = objectNames(date, now, runId);
    const startedAt = now.toISOString();
    try {
        const recipients = (deps.recipients || []).slice();
        if (!recipients.length) throw new Error('no age recipient configured (authBackupConfig.AGE_RECIPIENTS is empty)');
        recipients.forEach(age.parseRecipient); // validate before touching any user data

        const hashConfig = await deps.getHashConfig();
        const users = await listAllUsers(deps.auth);
        if (!users.length) throw new Error('listUsers returned 0 users');
        const summary = summarize(users, hashConfig);

        let plain = buildJsonl({ projectId: deps.projectId, createdAt: startedAt, date: date, userCount: users.length, hashConfig: hashConfig }, users);
        users.length = 0;
        const plaintextSha256 = sha256Hex(plain);
        const plaintextBytes = plain.length;
        const cipher = age.encrypt(plain, recipients);
        plain.fill(0);
        plain = null;
        const ciphertextSha256 = sha256Hex(cipher);

        await save(deps.bucket, names.data, cipher, 'application/octet-stream');
        const manifest = {
            format: HEADER_TYPE,
            encryption: 'age-v1-x25519',
            recipients: recipients,
            projectId: deps.projectId,
            date: date,
            runId: runId,
            startedAt: startedAt,
            finishedAt: new Date().toISOString(),
            object: names.data,
            manifestObject: names.manifest,
            userCount: summary.users,
            jsonlLines: summary.users + 1,
            passwordUsers: summary.passwordUsers,
            withPasswordHash: summary.withHash,
            mfaUsers: summary.mfaUsers,
            disabledUsers: summary.disabled,
            hashConfigIncluded: !!hashConfig,
            complete: summary.issues.length === 0,
            issues: summary.issues,
            ciphertextBytes: cipher.length,
            ciphertextSha256: ciphertextSha256,
            plaintextBytes: plaintextBytes,
            plaintextSha256: plaintextSha256,
        };
        await save(deps.bucket, names.manifest, Buffer.from(JSON.stringify(manifest, null, 2) + '\n'), 'application/json');
        log.log('[AUTH-BACKUP] wrote', names.data, 'users', summary.users, 'passwordUsers', summary.passwordUsers,
            'withHash', summary.withHash, 'hashConfig', !!hashConfig, 'bytes', cipher.length);
        if (summary.issues.length) throw new Error('auth export incomplete: ' + summary.issues.join('; '));
        return manifest;
    } catch (err) {
        const reason = sanitize(err && err.message);
        log.error('[AUTH-BACKUP] FAILED', date, reason);
        try {
            await save(deps.bucket, names.failed, Buffer.from(JSON.stringify({
                date: date, runId: runId, startedAt: startedAt, failedAt: new Date().toISOString(), reason: reason, object: names.data,
            }, null, 2) + '\n'), 'application/json');
        } catch (markerErr) {
            log.error('[AUTH-BACKUP] could not write failure marker:', sanitize(markerErr && markerErr.message));
        }
        throw new Error('dailyAuthExport failed: ' + reason);
    }
}

// Entry point used by functions/index.js.
async function runFromFunction(admin, fetchImpl) {
    const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || admin.app().options.projectId;
    return runAuthExport({
        auth: admin.auth(),
        bucket: admin.storage().bucket(cfg.authBackupBucket(projectId)),
        recipients: cfg.AGE_RECIPIENTS,
        projectId: projectId,
        getHashConfig: function () { return fetchHashConfig(admin, projectId, fetchImpl || fetch); },
    });
}

module.exports = {
    HEADER_TYPE: HEADER_TYPE,
    etDate: etDate,
    objectNames: objectNames,
    newRunId: newRunId,
    utcStamp: utcStamp,
    serializeAuthUser: serializeAuthUser,
    pickHashConfig: pickHashConfig,
    fetchHashConfig: fetchHashConfig,
    summarize: summarize,
    sanitize: sanitize,
    runAuthExport: runAuthExport,
    runFromFunction: runFromFunction,
};
