const functions = require('firebase-functions');
const functionsV1 = require('firebase-functions/v1');
const { defineSecret } = require('firebase-functions/params');
const referralIpSecret = defineSecret('REFERRAL_IP_HMAC_SECRET');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentCreated, onDocumentUpdated, onDocumentWritten, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { authenticator } = require("otplib");
const QRCode = require('qrcode');
const fetch = require('node-fetch');

admin.initializeApp();
const db = admin.firestore();
// REST instead of a gRPC channel. The gRPC handshake is a large part of a
// gen1 cold start. settings() throws if it runs twice or after any other
// Firestore method, so it has to happen here — before any collection read and
// before src modules that capture admin.firestore() at load — and only once
// per process.
//
// index.js is the shared gen1 entry, but Cloud Functions deploys each
// function as its own revision. Only a function deployed after this change
// picks it up. The first deploy is managePeer; every other function keeps
// its previous bundle (and gRPC) until that function is deployed again.
//
// @google-cloud/firestore 7.11.6 (firebase-admin 12.7.0): preferRest stays
// on HTTP/1.1 until something needs gRPC. The only such API is a snapshot
// listener (DocumentReference/CollectionReference/Query onSnapshot). Calling
// one loads gRPC and the client uses gRPC from then on, which drops the
// cold-start win for the rest of that instance. There are no listeners in
// functions/ today, so this is safe for every function that later deploys
// this file. Triggers (onDocumentCreated and the rest) are event deliveries,
// not client listeners, and are unaffected.
const _preferRestGlobal = typeof globalThis !== 'undefined' ? globalThis : global;
if (!_preferRestGlobal.__btcFirestorePreferRest) {
    db.settings({ preferRest: true });
    _preferRestGlobal.__btcFirestorePreferRest = true;
}
const { beatsCensor } = require('./src/beats-censor.js');
const { sendUserPush, broadcastCategory, cleanStaleTokens, releaseTokenFromOthers, capUserDevices } = require('./src/push');
const { testPushTargetAllowed } = require('./src/pushPrefs');
const { createPredictionJobs } = require('./src/predictionJobs');
const predictionJobs = createPredictionJobs(db, admin, { sendPush: sendUserPush });
// Daily key with 5-hour UTC offset — matches client getDailyKey() (resets at 5 AM UTC)
// Prevents server/client day mismatch that lets users double-complete daily challenges
function getOffsetDateKey() {
    const RESET_HOUR_UTC = 5;
    const shifted = new Date(Date.now() - RESET_HOUR_UTC * 3600 * 1000);
    return shifted.toISOString().split('T')[0];
}


// HTML escape for server-side email/notification content
function _escHtml(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── Admin auth helper ────────────────────────────────────────────
// Reads ADMIN_TOKEN from env; constant-time compare; accepts header OR query param.
// Allowed origins for CORS
const ALLOWED_ORIGINS = [
    'https://bitcoineducation.quest',
    'https://btcedu.app',
    'https://btcedu.quest',
];

// Set CORS headers, allowing only known origins.
// Returns true if origin is allowed (or if request is non-browser/direct).
function setCorsHeaders(req, res) {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        res.set('Access-Control-Allow-Origin', origin);
        res.set('Vary', 'Origin');
    }
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
    res.set('Access-Control-Max-Age', '86400');
    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return false; // caller should return after this
    }
    return true;
}

// Returns true and sets CORS + auth header if valid; sends 403 and returns false if not.
function requireAdmin(req, res) {
    if (!setCorsHeaders(req, res)) return false;
    const expected = process.env.ADMIN_TOKEN;
    if (!expected) {
        console.error('[requireAdmin] ADMIN_TOKEN env var not set');
        res.status(500).json({ error: 'server misconfiguration' });
        return false;
    }
    const provided = String(req.headers['x-admin-token'] || '');
    // Constant-time comparison to prevent timing attacks
    const expectedBuf = Buffer.from(expected);
    const providedBuf = Buffer.alloc(expectedBuf.length);
    Buffer.from(provided).copy(providedBuf);
    const match = provided.length === expected.length &&
        require('crypto').timingSafeEqual(expectedBuf, providedBuf);
    if (!match) {
        res.status(403).json({ error: 'forbidden' });
        return false;
    }
    return true;
}

// ── Admin audit log — writes to admin_audit_log collection ──────────────────
// Called after requireAdmin passes. Records caller IP, action, and params.
async function logAdminAction(req, action, params) {
    try {
        const ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown').split(',')[0].trim();
        await db.collection('admin_audit_log').add({
            action,
            params: JSON.stringify(params || {}).substring(0, 500),
            callerIp: ip,
            userAgent: (req.headers['user-agent'] || '').substring(0, 200),
            ts: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.error('[logAdminAction] failed to write audit log:', e.message);
    }
}

const { NWCClient } = require('@getalby/sdk');

// ── Cloudflare Turnstile verification ───────────────────────────────────────
async function verifyTurnstile(token, remoteip) {
    if (!token) return false;
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
        console.error('[Turnstile] TURNSTILE_SECRET_KEY not set — failing closed');
        return false;
    }
    try {
        const params = new URLSearchParams({ secret, response: token });
        if (remoteip) params.append('remoteip', remoteip);
        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });
        const result = await res.json();
        console.log('[Turnstile] verify result:', result.success, result['error-codes']);
        return result.success === true;
    } catch (e) {
        console.error('[Turnstile] verify error:', e.message);
        return false;
    }
}
const bolt11 = require('bolt11');
const dns = require('dns').promises;
const faucetGuard = require('./src/faucetGuard');
const rewardNotify = require('./src/rewardNotify');
const awardActions = require('./src/awardActions');
const ticketGrants = require('./src/ticketGrants');
const { grantServerTickets, claimNachoChat } = require('./src/grantServerTickets');
const doubleXp = require('./src/doubleXp');
const referralService = require('./src/referralService');
const referralDecisions = require('./src/referrals');
const tipService = require('./src/tipService');
// DNS check shared with confirmTipSent. String-only host checks are not enough.
const { assertPublicHost } = require('./src/publicHost');
const { resolveLnurlInvoice, normalizeLnAddress, RESOLVE_ERROR } = require('./src/lnurlResolve');
const pvpFlow = require('./src/pvpFlow');
const badgeRules = require('./src/badgeRules');
const { grantFamily, familyFor } = require('./src/grantBadge');
const { awardBadge } = require('./src/awardBadge');
const dailyFive = require('./src/dailyFive');
const { createPollVote } = require('./src/pollVote');
const { countMarketplaceMessage, countMarketplaceSale } = require('./src/marketMessages');
const activityCounters = require('./src/activityCounters');
const { refreshBadgeDistribution } = require('./src/badgeDistribution');
const progressBadges = require('./src/progressBadges');

// ===== VALID CHANNEL CATALOG (server-authoritative) =====
// Extracted from channel_index.js — used to reject fake channelId values
// that would otherwise inflate visitedChannelsList and forge faucet eligibility.
// Update this Set whenever channel_index.js gains new channels.
const VALID_CHANNEL_IDS = new Set(["0_mining__hashing","100_sats","1_first_principles","2__solved_technical_problems","analogies","apps-tools","art-inspiration","articles-threads","austrian_school_of_economics","bip119","bitcoin_exam","bitcoin_vs_real_estate","bitvm","block_time-block-size","blockchain-timechain","books","burn_bitcoin","byzantine_generals__problem","charts","chaumian-mints","chaumian_e-cash_and_blind_signatures","coin_mixing_coinjoin_coin_control_utxo","consensus","core-source-code","cryptography","ctv-covenants","curriculum","cyles","decentralized","derivation_path","developers","difficulty-adjustment","discrete_log_contracts__dlcs","dollar-bitcoin_milkshake_theory","dominant","dust","elevator_pitches","energy","environment___energy","evidence-against-alts","extension-blocks","faith___religion","faq-glossary","fedi-ark","fedimints","feedback_loops","free_and_open_source_software__foss","fun-facts","game_theory","games","geopolitics___macroeconomics","giga-chad","governance","graphics","ham_radio","hardware","health","history","human_rights__social_justice_and_freedo","improved_incentive_structure","informational-sites","international","investment-strategy","jobs-earn","laws_of_thermodynamics","layer-2-lightning","layer-3-sidechains","lightning_node","lindy_effect","market_cap","math","mathematics","maximalism","memes-funny","mev","mining","misconceptions-fud","money","movies-tv","music","network_effects","news-adoption","nodes","nostr","one-stop-shop","op-codes","open_source","oracle","orange-pilling","ordinals","ordinals__nfts_on_bitcoin__and_block_spa","organic","peace_and_anti-war","peaceful","philosophy","podcasts","poems-stories","politics","pow-vs-pos","predictions","privacy-nonkyc","problems-of-money","programmable","projects-diy","public_key_vs_private_key","rbf","referral-links","regulation","research-theses","risks__threats__attack_vectors__weaknes","rollups","satoshi-nakamoto","sats__or__bits","scalability","scarce","secure","self-custody","sidechains","simplified_payment_verification__spv","smart-contracts","social-media","soft_vs_hard_forks","softwar","stablecoins","stratum_v2","submarine_swap","supranational","swag-merch","swaps","ta_tips","tail_emission","taproot","taro","the_future","time","time_preference","toxicity","transaction_fees","unpopular_opinions","use-cases","utxos","vbyte","videos","web5","whitepaper"]);

// ===== SATS FAUCET CONFIG =====
const FAUCET = {
    POINTS_PER_SAT: 10,
    MIN_WITHDRAWAL_SATS: 100,
    MAX_PER_CLAIM_SATS: faucetGuard.MAX_PER_CLAIM_SATS,
    MAX_DAILY_PER_USER_SATS: faucetGuard.MAX_DAILY_PER_USER_SATS,
    MAX_LIFETIME_PER_USER_SATS: 15000,
    GLOBAL_DAILY_MAX_SATS: 10000,
    COOLDOWN_HOURS: 24,
    MIN_ACCOUNT_AGE_DAYS: 7,
    MIN_CHANNELS_READ: 10,
    WALLET_BALANCE_FLOOR_SATS: 5000,
    NWC_URL: process.env.NWC_URL || ''
};

// Authenticator sessions are totp_sessions/{uid}_{sessionId}.
// New setups fail closed until TOTP_ENCRYPTION_KEY is a 64-hex secret.
// Existing plaintext secrets still verify. Deploy the bound functions, then
// run migrate-totp-secrets.js (dry run, then --apply).
const { initSecondFactor, sweepExpiredMfaRows } = require('./src/secondFactor');
const secondFactor = initSecondFactor({
    db: db,
    admin: admin,
    HttpsError: functionsV1.https.HttpsError,
    authenticator: authenticator,
    QRCode: QRCode,
});
exports.totpSetup = secondFactor.totpSetup;
exports.totpVerify = secondFactor.totpVerify;
exports.totpCheck = secondFactor.totpCheck;
exports.totpDisable = secondFactor.totpDisable;
exports.totpStatus = secondFactor.totpStatus;
exports.totpRevokeSession = secondFactor.totpRevokeSession;
exports.totpResumeDevice = secondFactor.totpResumeDevice;
exports.totpStepUp = secondFactor.totpStepUp;
exports.totpListDevices = secondFactor.totpListDevices;
exports.totpRevokeDevice = secondFactor.totpRevokeDevice;
exports.totpSignOutOtherDevices = secondFactor.totpSignOutOtherDevices;
exports.totpRevokeAllTrust = secondFactor.totpRevokeAllTrust;
exports.issueRecoveryCodes = secondFactor.issueRecoveryCodes;
exports.regenerateRecoveryCodes = secondFactor.regenerateRecoveryCodes;
exports.useRecoveryCode = secondFactor.useRecoveryCode;
exports.phoneFactorRemoved = secondFactor.phoneFactorRemoved;
exports.adminResetSecondFactor = secondFactor.adminResetSecondFactor;

// =============================================
// Streak Reminder Push Notifications
// Fires at midnight UTC = 7 PM ET, warning users before the 5 AM UTC reset.
// Category "reminders". broadcastCategory checks each user's pref.
// =============================================
exports.streakReminder = onSchedule({ schedule: '0 0 * * *', timeZone: 'UTC', timeoutSeconds: 540 }, async (event) => {
        const today = getOffsetDateKey();
        const result = await broadcastCategory('reminders', async function (uid, userData) {
            const streak = userData.streak || 0;
            const lastVisit = userData.lastVisit;
            if (streak < 2 || !lastVisit || lastVisit === today) return null;
            return {
                title: 'Your ' + streak + '-day streak is about to expire',
                body: 'Open Bitcoin Quest before the reset to keep it alive.',
                url: 'https://bitcoineducation.quest/'
            };
        });
        console.log('Streak reminders', JSON.stringify(result));
        return null;
    });

// =============================================
// Weekly Quest Reminder (every Monday 3 PM UTC)
// =============================================
exports.weeklyQuestReminder = onSchedule({ schedule: '0 15 * * 1', timeZone: 'UTC', timeoutSeconds: 540 }, async (event) => {
        const result = await broadcastCategory('reminders', async function () {
            return {
                title: 'Start your Quest',
                body: 'New Bitcoin questions and channels are waiting.',
                url: 'https://bitcoineducation.quest/#questhub'
            };
        });
        console.log('Weekly quest reminders', JSON.stringify(result));
        return null;
    });

// =============================================
// Clean up stale/invalid push tokens (weekly)
// Dry-run probes each device token and deletes the ones FCM rejects.
// =============================================
exports.cleanPushTokens = onSchedule({ schedule: '0 3 * * 0', timeZone: 'UTC', timeoutSeconds: 540 }, async (event) => {
        const cleaned = await cleanStaleTokens();
        console.log('Cleaned ' + cleaned + ' stale push tokens');
        return null;
    });

// Admin claim can target any uid. Anyone else can target only themselves.
// The body is fixed server-side so a caller cannot put text in the notification.
exports.sendTestPush = functionsV1.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const caller = context.auth.uid;
    const isAdmin = context.auth.token && context.auth.token.admin === true;
    const target = String((data && data.uid) || caller).trim();
    if (!/^[A-Za-z0-9_-]{4,128}$/.test(target)) {
        throw new functionsV1.https.HttpsError('invalid-argument', 'uid required');
    }
    if (!testPushTargetAllowed(caller, target, isAdmin)) {
        throw new functionsV1.https.HttpsError('permission-denied', 'Admin only');
    }
    const result = await sendUserPush(target, 'rewards', {
        title: 'Bitcoin Quest test',
        body: 'Push is working on this device.',
        url: 'https://bitcoineducation.quest/#settings-notifications',
        type: 'test'
    }, {
        ignorePrefs: true,
        rateCategory: 'test',
        rateMax: isAdmin ? 20 : 3
    });
    return {
        ok: (result.sent || 0) > 0,
        sent: result.sent || 0,
        failed: result.failed || 0,
        reason: result.reason || ''
    };
});

// =============================================
// Nostr Sign-In (NIP-07)
// Verify Schnorr signature and issue Firebase custom token
// =============================================
exports.nostrAuth = functionsV1.https.onCall(async (data, context) => {
    const { pubkey, sig, event } = data;

    if (!pubkey || !sig || !event) {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Missing pubkey, sig, or event');
    }

    // Rate limiting: max 5 nostrAuth calls per IP per hour (atomic transaction).
    // The doc id is a keyed hash. The address is not stored.
    const nostrIP = faucetGuard.clientIpFromRequest(context && context.rawRequest);
    if (nostrIP) {
        const { networkRateDocId } = require('./src/rateLimitSalt');
        const nostrNow = Date.now();
        const nostrRateRef = db.collection('rate_limits').doc(await networkRateDocId(db, 'nostr_', nostrIP, nostrNow));
        const nostrExpire = new Date(nostrNow + 24 * 60 * 60 * 1000);
        await db.runTransaction(async (tx) => {
            const nostrRateDoc = await tx.get(nostrRateRef);
            if (nostrRateDoc.exists) {
                const rd = nostrRateDoc.data();
                const windowStart = rd.windowStart ? (rd.windowStart.toDate ? rd.windowStart.toDate() : new Date(rd.windowStart)) : null;
                if (windowStart && (Date.now() - windowStart.getTime()) < 3600000) {
                    if ((rd.attempts || 0) >= 5) {
                        throw new functionsV1.https.HttpsError('resource-exhausted', 'Too many sign-in attempts. Try again later.');
                    }
                    tx.update(nostrRateRef, { attempts: (rd.attempts || 0) + 1, expireAt: nostrExpire });
                } else {
                    tx.set(nostrRateRef, { attempts: 1, windowStart: admin.firestore.FieldValue.serverTimestamp(), expireAt: nostrExpire });
                }
            } else {
                tx.set(nostrRateRef, { attempts: 1, windowStart: admin.firestore.FieldValue.serverTimestamp(), expireAt: nostrExpire });
            }
        });
    }

    // Validate pubkey format (64 hex chars)
    if (!/^[a-f0-9]{64}$/.test(pubkey)) {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Invalid pubkey format');
    }

    // Parse and validate the event
    let nostrEvent;
    try {
        nostrEvent = typeof event === 'string' ? JSON.parse(event) : event;
    } catch(e) {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Invalid event format');
    }

    // Verify it's a kind 27235 (NIP-98 HTTP Auth) or kind 22242 (auth) event
    if (nostrEvent.kind !== 27235 && nostrEvent.kind !== 22242) {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Invalid event kind');
    }

    // Verify event is recent (within 5 minutes)
    const eventTime = nostrEvent.created_at || 0;
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - eventTime) > 300) {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Event too old or too far in future');
    }

    // Verify the Schnorr signature
    try {
        const secp = require('@noble/secp256k1');
        const crypto = require('crypto');

        // Required for @noble/secp256k1 v1.x on Node 22+
        if (!secp.utils.sha256Sync) {
            secp.utils.sha256Sync = (...msgs) => {
                const h = crypto.createHash('sha256');
                msgs.forEach(m => h.update(m));
                return Uint8Array.from(h.digest());
            };
        }
        if (!secp.utils.hmacSha256Sync) {
            secp.utils.hmacSha256Sync = (key, ...msgs) => {
                const h = crypto.createHmac('sha256', key);
                msgs.forEach(m => h.update(m));
                return Uint8Array.from(h.digest());
            };
        }

        // Compute event ID (SHA256 of serialized event per NIP-01)
        const serialized = JSON.stringify([
            0,
            nostrEvent.pubkey,
            nostrEvent.created_at,
            nostrEvent.kind,
            nostrEvent.tags || [],
            nostrEvent.content || ''
        ]);
        const eventId = crypto.createHash('sha256').update(serialized).digest('hex');

        // SECURITY: Always verify the signature against our OWN recomputed eventId,
        // never against a client-supplied id. Accepting a client-supplied id allows an
        // attacker to harvest any real (id, sig, pubkey) triple from a public Nostr note
        // and replay it as a login event, forging kind/created_at to pass freshness checks
        // while the signature still verifies correctly against the original note's id.
        //
        // If the client provides an id it must match our computation, otherwise reject.
        // This is the canonical NIP-01 requirement: id = SHA256 of the serialized event.
        if (nostrEvent.id && nostrEvent.id !== eventId) {
            console.error('Nostr event id mismatch. client:', nostrEvent.id.substring(0,16), 'computed:', eventId.substring(0,16));
            throw new functionsV1.https.HttpsError('permission-denied', 'Event id mismatch - signature not bound to this event');
        }

        // Get the actual signature - from the event object or the top-level sig param
        const actualSig = (nostrEvent.sig && /^[a-f0-9]{128}$/.test(nostrEvent.sig)) ? nostrEvent.sig : sig;

        // Verify signature against the server-recomputed eventId only
        const sigBytes = Buffer.from(actualSig, 'hex');
        const pubkeyBytes = Buffer.from(pubkey, 'hex');

        let valid = false;
        try {
            valid = secp.schnorr.verifySync(sigBytes, Buffer.from(eventId, 'hex'), pubkeyBytes);
        } catch(e1) { /* falls through to !valid throw below */ }

        if (!valid) {
            console.error('Nostr sig verify FAILED. computedId:', eventId.substring(0,16), 'sigLen:', actualSig.length, 'pubkey:', pubkey.substring(0,16));
            throw new functionsV1.https.HttpsError('permission-denied', 'Signature verification failed');
        }
    } catch(e) {
        if (e instanceof functionsV1.https.HttpsError) throw e;
        console.error('Nostr sig verify error:', e.message, 'sig len:', sig ? sig.length : 0, 'pubkey:', pubkey ? pubkey.substring(0,16) : 'none');
        throw new functionsV1.https.HttpsError('internal', 'Signature verification failed');
    }

    // Create or get Firebase user by Nostr pubkey
    const nostrUid = 'nostr:' + pubkey;

    try {
        // Try to get existing user
        await admin.auth().getUser(nostrUid);
    } catch(e) {
        // Create new user
        await admin.auth().createUser({
            uid: nostrUid,
            displayName: 'npub...' + pubkey.substring(0, 8),
        });
    }

    // Create custom token
    const customToken = await admin.auth().createCustomToken(nostrUid, {
        nostrPubkey: pubkey,
    });

    // Store/update pubkey in Firestore
    await db.collection('users').doc(nostrUid).set({
        nostr: pubkey,
        lastLogin: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return { token: customToken, uid: nostrUid };
});

// =============================================
// LNURL-auth - Lightning Login
// =============================================

// Step 1: Generate a challenge (k1) and return LNURL
exports.lnAuthChallenge = functionsV1.https.onCall(async (data, context) => {
    // Rate limiting: max 10 challenges per IP per hour (atomic transaction).
    // The doc id is a keyed hash. The address is not stored.
    const lnIP = faucetGuard.clientIpFromRequest(context && context.rawRequest);
    if (lnIP) {
        const { networkRateDocId } = require('./src/rateLimitSalt');
        const lnNow = Date.now();
        const lnRateRef = db.collection('rate_limits').doc(await networkRateDocId(db, 'lnauth_', lnIP, lnNow));
        const lnExpire = new Date(lnNow + 24 * 60 * 60 * 1000);
        await db.runTransaction(async (tx) => {
            const lnRateDoc = await tx.get(lnRateRef);
            if (lnRateDoc.exists) {
                const rd = lnRateDoc.data();
                const ws = rd.windowStart ? (rd.windowStart.toDate ? rd.windowStart.toDate() : new Date(rd.windowStart)) : null;
                if (ws && (Date.now() - ws.getTime()) < 3600000) {
                    if ((rd.attempts || 0) >= 10) throw new functionsV1.https.HttpsError('resource-exhausted', 'Too many requests. Try again later.');
                    tx.update(lnRateRef, { attempts: (rd.attempts || 0) + 1, expireAt: lnExpire });
                } else {
                    tx.set(lnRateRef, { attempts: 1, windowStart: admin.firestore.FieldValue.serverTimestamp(), expireAt: lnExpire });
                }
            } else {
                tx.set(lnRateRef, { attempts: 1, windowStart: admin.firestore.FieldValue.serverTimestamp(), expireAt: lnExpire });
            }
        });
    }

    const crypto = require('crypto');
    const k1 = crypto.randomBytes(32).toString('hex');

    // Store challenge in Firestore with 5-minute TTL
    await db.collection('lnauth_challenges').doc(k1).set({
        created: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        status: 'pending',
    });

    // Build the LNURL-auth URL
    // This points to our HTTP callback endpoint
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'bitcoin-education-archive';
    const region = 'us-central1';
    const callbackUrl = `https://${region}-${projectId}.cloudfunctions.net/lnAuthCallback?tag=login&k1=${k1}&action=login`;

    // Bech32-encode the URL as LNURL
    const lnurlEncoded = bech32Encode(callbackUrl);

    return { k1, lnurl: lnurlEncoded, callbackUrl };
});

// Step 2: HTTP callback endpoint - wallet calls this with sig + key
exports.lnAuthCallback = functionsV1.https.onRequest(async (req, res) => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', 'https://bitcoineducation.quest');

    const { k1, sig, key, tag } = req.query;

    if (!k1 || !sig || !key) {
        return res.json({ status: 'ERROR', reason: 'Missing k1, sig, or key' });
    }

    // Validate k1 exists and is pending
    const challengeDoc = await db.collection('lnauth_challenges').doc(k1).get();
    if (!challengeDoc.exists) {
        return res.json({ status: 'ERROR', reason: 'Unknown or expired challenge' });
    }
    const challenge = challengeDoc.data();
    if (challenge.status !== 'pending') {
        return res.json({ status: 'ERROR', reason: 'Challenge already used' });
    }
    // Check expiry
    if (challenge.expiresAt && challenge.expiresAt.toDate() < new Date()) {
        await db.collection('lnauth_challenges').doc(k1).delete();
        return res.json({ status: 'ERROR', reason: 'Challenge expired' });
    }

    // Verify the ECDSA signature
    try {
        const secp = require('@noble/secp256k1');
        const crypto2 = require('crypto');

        // Required for @noble/secp256k1 v1.x on Node 22+
        if (!secp.utils.sha256Sync) {
            secp.utils.sha256Sync = (...msgs) => {
                const h = crypto2.createHash('sha256');
                msgs.forEach(m => h.update(m));
                return Uint8Array.from(h.digest());
            };
        }
        if (!secp.utils.hmacSha256Sync) {
            secp.utils.hmacSha256Sync = (key, ...msgs) => {
                const h = crypto2.createHmac('sha256', key);
                msgs.forEach(m => h.update(m));
                return Uint8Array.from(h.digest());
            };
        }

        const k1Bytes = Buffer.from(k1, 'hex');
        const sigBytes = Buffer.from(sig, 'hex');
        const keyBytes = Buffer.from(key, 'hex');

        // DER-decode the signature to get r,s
        const parsed = parseDERSignature(sigBytes);
        if (!parsed) {
            return res.json({ status: 'ERROR', reason: 'Invalid signature format' });
        }

        // Verify using secp256k1
        const sigObj = new secp.Signature(parsed.r, parsed.s);
        const valid = secp.verify(sigObj, k1Bytes, keyBytes);

        if (!valid) {
            return res.json({ status: 'ERROR', reason: 'Invalid signature' });
        }
    } catch(e) {
        console.error('LNURL-auth sig verify error:', e);
        return res.json({ status: 'ERROR', reason: 'Signature verification failed' });
    }

    // Signature valid - mark challenge as completed with the linking key
    // Firebase UIDs max 128 chars. If key is too long (uncompressed pubkey = 130 hex), hash it.
    const crypto3 = require('crypto');
    const lnUid = ('ln:' + key).length <= 128 ? 'ln:' + key : 'ln:' + crypto3.createHash('sha256').update(key).digest('hex');

    // Create Firebase auth user if needed
    try {
        await admin.auth().getUser(lnUid);
    } catch(e) {
        try {
            await admin.auth().createUser({
                uid: lnUid,
                displayName: '⚡wallet-' + key.substring(0, 12),
            });
        } catch(createErr) {
            console.error('Create user error:', createErr);
            return res.json({ status: 'ERROR', reason: 'Failed to create user account' });
        }
    }

    // Create custom token
    let customToken;
    try {
        customToken = await admin.auth().createCustomToken(lnUid, {
            lnPubkey: key,
        });
    } catch(tokenErr) {
        console.error('Custom token error:', tokenErr);
        return res.json({ status: 'ERROR', reason: 'Failed to generate auth token. Please try again.' });
    }

    // Update challenge doc with auth result
    // Mark challenge as completed - token is generated fresh by lnAuthVerify (never stored)
    await db.collection('lnauth_challenges').doc(k1).update({
        status: 'completed',
        linkingKey: key,
        uid: lnUid,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update/create user doc
    await db.collection('users').doc(lnUid).set({
        lnPubkey: key,
        authMethod: 'lightning',
        lastLogin: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return res.json({ status: 'OK' });
});

// Step 3: Client polls this to check if wallet completed auth
exports.lnAuthVerify = functionsV1.https.onCall(async (data, context) => {
    const { k1 } = data;
    if (!k1) throw new functionsV1.https.HttpsError('invalid-argument', 'Missing k1');

    // Rate limiting: max 20 polls per IP per minute (atomic transaction).
    // The doc id is a keyed hash. The address is not stored.
    const verifyIP = (context.rawRequest && context.rawRequest.ip) || 'unknown';
    if (verifyIP !== 'unknown') {
        const { networkRateDocId } = require('./src/rateLimitSalt');
        const verifyNow = Date.now();
        const vrRef = db.collection('rate_limits').doc(await networkRateDocId(db, 'lnverify_', verifyIP, verifyNow));
        const verifyExpire = new Date(verifyNow + 24 * 60 * 60 * 1000);
        await db.runTransaction(async (tx) => {
            const vrDoc = await tx.get(vrRef);
            if (vrDoc.exists) {
                const rd = vrDoc.data();
                const ws = rd.windowStart ? (rd.windowStart.toDate ? rd.windowStart.toDate() : new Date(rd.windowStart)) : null;
                if (ws && (Date.now() - ws.getTime()) < 60000) {
                    if ((rd.attempts || 0) >= 20) throw new functionsV1.https.HttpsError('resource-exhausted', 'Too many requests');
                    tx.update(vrRef, { attempts: (rd.attempts || 0) + 1, expireAt: verifyExpire });
                } else {
                    tx.set(vrRef, { attempts: 1, windowStart: admin.firestore.FieldValue.serverTimestamp(), expireAt: verifyExpire });
                }
            } else {
                tx.set(vrRef, { attempts: 1, windowStart: admin.firestore.FieldValue.serverTimestamp(), expireAt: verifyExpire });
            }
        });
    }

    // [SECURITY FIX] Atomic consume: claim challenge in a transaction to prevent TOCTOU
    // (two concurrent calls both minting tokens). Soft-consume BEFORE createCustomToken so a
    // mint failure does not permanently destroy a wallet-signed k1.
    let challenge;
    const challengeRef = db.collection('lnauth_challenges').doc(k1);
    try {
        await db.runTransaction(async (tx) => {
            const doc = await tx.get(challengeRef);
            if (!doc.exists) throw new functionsV1.https.HttpsError('not-found', 'Challenge not found');
            const data = doc.data();
            if (data.expiresAt) {
                const expires = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
                if (Date.now() > expires.getTime()) {
                    tx.delete(doc.ref);
                    throw new functionsV1.https.HttpsError('deadline-exceeded', 'Challenge expired');
                }
            }
            if (data.status === 'completed') {
                // First claim — flip to consumed so only one caller proceeds
                tx.update(doc.ref, {
                    status: 'consumed',
                    consumedAt: admin.firestore.FieldValue.serverTimestamp(),
                    mintPending: true,
                });
                challenge = data;
            } else if (data.status === 'consumed' && data.mintPending === true) {
                // Prior mint failed — allow a single remint attempt by clearing mintPending claim
                tx.update(doc.ref, { mintPending: false, remintAt: admin.firestore.FieldValue.serverTimestamp() });
                challenge = data;
            } else {
                throw new functionsV1.https.HttpsError('not-found', 'Not yet authenticated');
            }
        });
    } catch (e) {
        if (e instanceof functionsV1.https.HttpsError) throw e;
        throw new functionsV1.https.HttpsError('internal', 'Transaction failed');
    }

    const uid = challenge.uid;
    const linkingKey = challenge.linkingKey;
    if (!uid) throw new functionsV1.https.HttpsError('internal', 'Invalid challenge state');

    let token;
    try {
        token = await admin.auth().createCustomToken(uid, { lnPubkey: linkingKey || '' });
    } catch(e) {
        // Restore mintPending so a later poll can remint
        try { await challengeRef.update({ mintPending: true }); } catch (_) {}
        throw new functionsV1.https.HttpsError('internal', 'Token generation failed');
    }

    // Hard-delete after successful mint (one-time use)
    try { await challengeRef.delete(); } catch (_) { /* best-effort cleanup */ }

    return { token: token, uid: uid };
});

// Helper: Parse DER-encoded ECDSA signature into r, s BigInts
function parseDERSignature(buf) {
    try {
        if (buf[0] !== 0x30) return null;
        let offset = 2;
        // r
        if (buf[offset] !== 0x02) return null;
        offset++;
        const rLen = buf[offset]; offset++;
        const rBytes = buf.slice(offset, offset + rLen); offset += rLen;
        // s
        if (buf[offset] !== 0x02) return null;
        offset++;
        const sLen = buf[offset]; offset++;
        const sBytes = buf.slice(offset, offset + sLen);

        const r = BigInt('0x' + Buffer.from(rBytes).toString('hex'));
        const s = BigInt('0x' + Buffer.from(sBytes).toString('hex'));
        return { r, s };
    } catch(e) {
        return null;
    }
}

// Helper: Bech32 encode URL to LNURL format
function bech32Encode(url) {
    const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    const hrp = 'lnurl';

    function polymod(values) {
        let chk = 1;
        for (let p = 0; p < values.length; ++p) {
            let top = chk >> 25;
            chk = ((chk & 0x1ffffff) << 5) ^ values[p];
            for (let i = 0; i < 5; ++i) {
                if ((top >> i) & 1) {
                    chk ^= [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3][i];
                }
            }
        }
        return chk;
    }

    function hrpExpand(hrp) {
        let ret = [];
        for (let p = 0; p < hrp.length; ++p) ret.push(hrp.charCodeAt(p) >> 5);
        ret.push(0);
        for (let p = 0; p < hrp.length; ++p) ret.push(hrp.charCodeAt(p) & 31);
        return ret;
    }

    function createChecksum(hrp, data) {
        let values = hrpExpand(hrp).concat(data).concat([0, 0, 0, 0, 0, 0]);
        let pm = polymod(values) ^ 1;
        let ret = [];
        for (let p = 0; p < 6; ++p) ret.push((pm >> (5 * (5 - p))) & 31);
        return ret;
    }

    function convertBits(data, fromBits, toBits, pad) {
        let acc = 0, bits = 0, ret = [], maxv = (1 << toBits) - 1;
        for (let p = 0; p < data.length; ++p) {
            let value = data[p];
            acc = (acc << fromBits) | value;
            bits += fromBits;
            while (bits >= toBits) {
                bits -= toBits;
                ret.push((acc >> bits) & maxv);
            }
        }
        if (pad) {
            if (bits > 0) ret.push((acc << (toBits - bits)) & maxv);
        }
        return ret;
    }

    const urlBytes = Buffer.from(url, 'utf-8');
    const data5bit = convertBits(Array.from(urlBytes), 8, 5, true);
    const checksum = createChecksum(hrp, data5bit);
    const combined = data5bit.concat(checksum);

    let result = hrp + '1';
    for (let p = 0; p < combined.length; ++p) result += CHARSET.charAt(combined[p]);
    return result.toUpperCase();
}

// =============================================
// Forum Post Notification - email admin on new post
// =============================================
exports.onForumPost = onDocumentCreated('forum_posts/{postId}', async (event) => {
    const snap = event.data; const context = { params: event.params };
        const post = snap.data();
        const postId = context.params.postId;
        if (!activityCounters.forumActivityAwardable(post)) return null;
        const authorId = post.authorId || 'unknown';
        if (authorId !== 'unknown' && String(post.title || '').trim()) {
            await grantServerTickets(authorId, 'forum_post_ticket');
        }

        try {
            // 🔒 SECURITY (M-NEW-21): Rate limit admin emails to prevent amplification attacks
            // Check for other forum post notifications from this user in the last hour
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const recentNotifsSnap = await db.collection('admin_notifications')
                .where('type', '==', 'forum_post')
                .where('authorId', '==', authorId)
                .where('createdAt', '>', oneHourAgo)
                .limit(5)
                .get();

            // If user has triggered > 3 notification emails in an hour, skip the email (but log the notif)
            const skipEmail = recentNotifsSnap.size >= 3;

            // Store notification for admin (server-side only)
            await db.collection('admin_notifications').add({
                type: 'forum_post',
                postId: postId,
                authorId: authorId,
                title: post.title || '',
                author: post.authorName || 'Unknown',
                category: post.category || 'general',
                body: (post.body || '').substring(0, 200),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false,
                emailSent: !skipEmail
            });

            if (skipEmail) {
                console.log(`[ForumNotif] Skipping email for user ${authorId} (rate limit exceeded)`);
                return null;
            }

            // Send email via nodemailer
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: functions.config().mail ? functions.config().mail.user : '',
                    pass: functions.config().mail ? functions.config().mail.pass : ''
                }
            });

            if (functions.config().mail && functions.config().mail.user) {
                await transporter.sendMail({
                    from: '"Bitcoin Education Archive" <' + functions.config().mail.user + '>',
                    to: 'needcreations@gmail.com',
                    subject: '🗣️ New Forum Post: ' + (post.title || 'Untitled'),
                    html: '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">' +
                        '<h2 style="color:#f7931a;">🗣️ New Forum Post</h2>' +
                        '<div style="background:#1a1a2e;border:1px solid #333;border-radius:12px;padding:16px;margin-bottom:16px;">' +
                            '<h3 style="color:#fff;margin:0 0 8px;">' + _escHtml(post.title || 'Untitled') + '</h3>' +
                            '<div style="color:#aaa;font-size:0.9rem;">By: ' + _escHtml(post.authorName || 'Unknown') + ' · Category: ' + _escHtml(post.category || 'general') + '</div>' +
                            (post.body ? '<p style="color:#ccc;margin-top:12px;">' + _escHtml((post.body || '').substring(0, 300)) + (post.body.length > 300 ? '...' : '') + '</p>' : '') +
                        '</div>' +
                        '<a href="https://bitcoineducation.quest/#forum" style="display:inline-block;padding:10px 24px;background:#f7931a;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">View Forum →</a>' +
                    '</div>'
                });
            }
        } catch(e) {
            console.error('Forum notification error:', e);
        }

        return null;
    });

// Nacho announces a new top-level PlebTalk post or Marketplace listing in
// Global Chat, then mirrors it through the shoutout Telegram bridge.
// Separate from onForumPost so a mail failure cannot drop the chat post.
const { announceActivity, retractActivity, retractIfRemoved } = require('./src/activityShoutout');
const { countMarketplaceListing } = require('./src/marketListingCount');

const ACTIVITY_SHOUTOUT_OPTS = { maxInstances: 10 };

exports.onForumShoutout = onDocumentCreated({
    document: 'forum_posts/{postId}',
    maxInstances: ACTIVITY_SHOUTOUT_OPTS.maxInstances,
}, async (event) => {
    if (!event.data) return null;
    if (!activityCounters.forumActivityAwardable(event.data.data())) return null;
    try {
        await announceActivity({
            kind: 'forum',
            id: event.params.postId,
            db: db,
            admin: admin,
            eventData: event.data.data(),
        });
    } catch (e) {
        console.error('[onForumShoutout] failed', e && e.message ? e.message : '');
        throw e;
    }
    return null;
});

exports.onMarketplaceShoutout = onDocumentCreated({
    document: 'marketplace/{listingId}',
    maxInstances: ACTIVITY_SHOUTOUT_OPTS.maxInstances,
}, async (event) => {
    if (!event.data) return null;
    try {
        await announceActivity({
            kind: 'marketplace',
            id: event.params.listingId,
            db: db,
            admin: admin,
            eventData: event.data.data(),
        });
    } catch (e) {
        console.error('[onMarketplaceShoutout] failed', e && e.message ? e.message : '');
        throw e;
    }
    return null;
});

// Listing badge counter. Separate from the shoutout so a Nacho skip or its
// grace delay does not drop the count. Idempotent per listing id.
exports.onMarketplaceListingCount = onDocumentCreated({
    document: 'marketplace/{listingId}',
    maxInstances: ACTIVITY_SHOUTOUT_OPTS.maxInstances,
}, async (event) => {
    if (!event.data) return null;
    const listing = event.data.data() || {};
    if (listing.sellerUid && listing.status !== 'deleted') {
        await grantServerTickets(listing.sellerUid, 'marketplace_listing_ticket');
    }
    try {
        const counted = await countMarketplaceListing({
            db: db,
            admin: admin,
            listingId: event.params.listingId,
            data: event.data.data(),
        });
        if (counted && counted.counted && counted.uid) {
            await grantFamily(db, admin, counted.uid, familyFor('marketListings'));
        }
    } catch (e) {
        console.error('[onMarketplaceListingCount] failed', e && e.message ? e.message : '');
        throw e;
    }
    return null;
});


exports.onMarketplaceMessageCount = onDocumentCreated({
    document: 'marketplace_messages/{messageId}',
    maxInstances: ACTIVITY_SHOUTOUT_OPTS.maxInstances,
}, async (event) => {
    if (!event.data) return null;
    try {
        const counted = await countMarketplaceMessage({ db: db, admin: admin, data: event.data.data() });
        if (counted && counted.counted && counted.uid) {
            await grantFamily(db, admin, counted.uid, familyFor('marketMessages'));
        }
    } catch (e) {
        console.error('[onMarketplaceMessageCount] failed', e && e.message ? e.message : '');
    }
    return null;
});

exports.onMarketplaceSaleCount = onDocumentUpdated({
    document: 'marketplace/{listingId}',
    maxInstances: ACTIVITY_SHOUTOUT_OPTS.maxInstances,
}, async (event) => {
    if (!event.data || !event.data.after) return null;
    try {
        const counted = await countMarketplaceSale({
            db: db,
            admin: admin,
            listingId: event.params.listingId,
            before: event.data.before && event.data.before.exists ? event.data.before.data() : {},
            after: event.data.after.exists ? event.data.after.data() : {},
        });
        if (counted && counted.counted && counted.uid) {
            await grantFamily(db, admin, counted.uid, familyFor('marketSold'));
        }
    } catch (e) {
        console.error('[onMarketplaceSaleCount] failed', e && e.message ? e.message : '');
    }
    return null;
});

exports.onChatBadgeCount = onDocumentCreated({
    document: 'global_chat/{messageId}',
    maxInstances: ACTIVITY_SHOUTOUT_OPTS.maxInstances,
}, async (event) => {
    if (!event.data) return null;
    try { await activityCounters.recordChat(db, admin, event.data.data()); }
    catch (e) { console.warn('[onChatBadgeCount]', e && e.message); }
    return null;
});

exports.onDmBadgeCount = onDocumentCreated({
    document: 'dm_conversations/{threadId}/messages/{messageId}',
    maxInstances: ACTIVITY_SHOUTOUT_OPTS.maxInstances,
}, async (event) => {
    if (!event.data) return null;
    try { await activityCounters.recordDm(db, admin, event.data.data()); }
    catch (e) { console.warn('[onDmBadgeCount]', e && e.message); }
    return null;
});

exports.onForumPostBadgeCount = onDocumentCreated({
    document: 'forum_posts/{postId}',
    maxInstances: ACTIVITY_SHOUTOUT_OPTS.maxInstances,
}, async (event) => {
    if (!event.data) return null;
    try { await activityCounters.recordForumPost(db, admin, event.data.data()); }
    catch (e) { console.warn('[onForumPostBadgeCount]', e && e.message); }
    return null;
});

exports.onForumReplyBadgeCount = onDocumentCreated({
    document: 'forum_replies/{replyId}',
    maxInstances: ACTIVITY_SHOUTOUT_OPTS.maxInstances,
}, async (event) => {
    if (!event.data) return null;
    try { await activityCounters.recordForumReply(db, admin, event.data.data()); }
    catch (e) { console.warn('[onForumReplyBadgeCount]', e && e.message); }
    return null;
});

exports.onBeatsUploadBadgeCount = onDocumentCreated({
    document: 'beats_tracks/{trackId}',
    maxInstances: ACTIVITY_SHOUTOUT_OPTS.maxInstances,
}, async (event) => {
    if (!event.data) return null;
    try { await activityCounters.recordBeatsUpload(db, admin, event.data.data()); }
    catch (e) { console.warn('[onBeatsUploadBadgeCount]', e && e.message); }
    return null;
});

exports.onArticleBadgeCount = onDocumentCreated({
    document: 'articles/{articleId}',
    maxInstances: ACTIVITY_SHOUTOUT_OPTS.maxInstances,
}, async (event) => {
    if (!event.data) return null;
    try { await activityCounters.recordArticle(db, admin, event.data.data()); }
    catch (e) { console.warn('[onArticleBadgeCount]', e && e.message); }
    return null;
});

// Retries a collection bonus if awardBadge committed the last member and the
// grant hook then failed. Existing award docs do not fire this, so a deploy
// does not pay historical completions. The grant itself stays idempotent.
exports.onBadgeAwardCreated = onDocumentCreated('users/{uid}/badge_awards/{badgeId}', async (event) => {
    const uid = event.params && event.params.uid;
    const badgeId = event.params && event.params.badgeId;
    if (!uid || !badgeId) return null;
    await require('./src/collectionBonus').maybeGrantForBadge(db, admin, uid, badgeId);
    return null;
});

exports.dailyPollVote = functionsV1.https.onCall(createPollVote({
    admin: admin,
    db: db,
    HttpsError: functionsV1.https.HttpsError,
    afterVote: async function (uid, day) {
        await dailyFive.maybeCompleteTrifecta({
            db: db, admin: admin, uid: uid, day: day, creditDailyAllThree: require('./src/satoshiFavor').creditDailyAllThree,
        });
        await dailyFive.maybeCompleteDailyFive({ db: db, admin: admin, uid: uid, day: day });
    },
}));

exports.reconcileDailyProofs = onSchedule({
    schedule: '15 5 * * *',
    timeZone: 'UTC',
    memory: '512MiB',
    timeoutSeconds: 540,
}, async () => {
    const day = dailyFive.previousOffsetDay(Date.now());
    let cursor = null;
    while (true) {
        let q = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(100);
        if (cursor) q = q.startAfter(cursor);
        const snap = await q.get();
        if (snap.empty) break;
        let found = { users: [] };
        try { found = await admin.auth().getUsers(snap.docs.map(function (doc) { return { uid: doc.id }; })); }
        catch (e) { found = { users: [] }; }
        const byUid = {};
        (found.users || []).forEach(function (rec) { byUid[rec.uid] = rec; });
        for (let i = 0; i < snap.docs.length; i++) {
            const doc = snap.docs[i];
            const data = doc.data() || {};
            const rec = byUid[doc.id];
            if (!rec || !rec.providerData || rec.providerData.length === 0) continue;
            if (data.ban_reason || data.banned === true || data.satsDisabled === true) continue;
            try {
                await dailyFive.maybeCompleteTrifecta({
                    db: db, admin: admin, uid: doc.id, day: day, creditDailyAllThree: require('./src/satoshiFavor').creditDailyAllThree,
                });
                await dailyFive.maybeCompleteDailyFive({ db: db, admin: admin, uid: doc.id, day: day });
            } catch (e) { console.warn('[reconcileDailyProofs]', doc.id, e && e.message); }
        }
        cursor = snap.docs[snap.docs.length - 1];
        if (snap.size < 100) break;
    }
});

exports.onIrlEventCreated = onDocumentCreated('irl_events/{eventId}', async (event) => {
    if (!event.data) return null;
    const ev = event.data.data() || {};
    if (!ev.hostId || !String(ev.title || '').trim()) return null;
    await grantServerTickets(ev.hostId, 'irl_listing_ticket');
    return null;
});

exports.claimNachoChatTicket = functionsV1.https.onCall(async (data, context) => {
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    const provider = (context.auth.token.firebase || {}).sign_in_provider || '';
    if (provider === 'anonymous') {
        throw new functionsV1.https.HttpsError('permission-denied', 'Sign in to earn this ticket');
    }
    const result = await claimNachoChat(context.auth.uid, data && data.text);
    return { success: result.tickets > 0, tickets: result.tickets || 0 };
});

exports.onForumShoutoutDeleted = onDocumentDeleted({
    document: 'forum_posts/{postId}',
    maxInstances: ACTIVITY_SHOUTOUT_OPTS.maxInstances,
}, async (event) => {
    try {
        await retractActivity({
            kind: 'forum',
            id: event.params.postId,
            db: db,
        });
    } catch (e) {
        console.error('[onForumShoutoutDeleted] failed', e && e.message ? e.message : '');
        throw e;
    }
    return null;
});

exports.onMarketplaceShoutoutDeleted = onDocumentDeleted({
    document: 'marketplace/{listingId}',
    maxInstances: ACTIVITY_SHOUTOUT_OPTS.maxInstances,
}, async (event) => {
    try {
        await retractActivity({
            kind: 'marketplace',
            id: event.params.listingId,
            db: db,
        });
    } catch (e) {
        console.error('[onMarketplaceShoutoutDeleted] failed', e && e.message ? e.message : '');
        throw e;
    }
    return null;
});

// In-app marketplace removal sets status 'deleted' and deletedAt instead of
// deleting the document. Forum posts are deleted outright; this still clears
// a shoutout if a post is later marked deleted, removed, or hidden.
exports.onForumShoutoutUpdated = onDocumentUpdated({
    document: 'forum_posts/{postId}',
    maxInstances: ACTIVITY_SHOUTOUT_OPTS.maxInstances,
}, async (event) => {
    if (!event.data) return null;
    try {
        await retractIfRemoved({
            kind: 'forum',
            id: event.params.postId,
            db: db,
            before: event.data.before.data(),
            after: event.data.after.data(),
        });
    } catch (e) {
        console.error('[onForumShoutoutUpdated] failed', e && e.message ? e.message : '');
        throw e;
    }
    return null;
});

exports.onMarketplaceShoutoutUpdated = onDocumentUpdated({
    document: 'marketplace/{listingId}',
    maxInstances: ACTIVITY_SHOUTOUT_OPTS.maxInstances,
}, async (event) => {
    if (!event.data) return null;
    try {
        await retractIfRemoved({
            kind: 'marketplace',
            id: event.params.listingId,
            db: db,
            before: event.data.before.data(),
            after: event.data.after.data(),
        });
    } catch (e) {
        console.error('[onMarketplaceShoutoutUpdated] failed', e && e.message ? e.message : '');
        throw e;
    }
    return null;
});

// =============================================
// Push Notification: Spin Wheel Reminder
// Runs every Monday, Wednesday, Friday at 10am ET
// =============================================
exports.spinReminder = onSchedule({
    schedule: 'every monday,wednesday,friday 10:00',
    timeZone: 'America/New_York',
    timeoutSeconds: 540,
    retryCount: 0,
}, async (event) => {
    try {
        const result = await broadcastCategory('reminders', async function () {
            return {
                title: 'Your spin is ready',
                body: 'Spin the wheel for free Orange Tickets.',
                url: 'https://bitcoineducation.quest/#questhub'
            };
        });
        console.log('Spin reminders', JSON.stringify(result));
        return null;
    } catch (e) {
        console.error('Spin reminder error:', e);
        return null;
    }
});

// =============================================
// Nacho Feedback Report - runs daily, reports every 100 interactions
// =============================================
exports.nachoFeedbackReport = onSchedule({
    schedule: 'every day 09:00',
    timeZone: 'America/New_York',
    retryCount: 0,
}, async (event) => {
    try {
        const counterDoc = await db.collection('analytics').doc('nacho_feedback').get();
        if (!counterDoc.exists) return null;

        const data = counterDoc.data();
        const total = data.total || 0;
        const lastReported = data.lastReportedAt || 0;
        const lastReportedTotal = data.lastReportedTotal || 0;

        // Only report every 100 new interactions
        if (total - lastReportedTotal < 100) return null;

        const thumbsUp = data.thumbsUp || 0;
        const thumbsDown = data.thumbsDown || 0;
        const satisfaction = total > 0 ? Math.round((thumbsUp / total) * 100) : 0;

        // Get recent feedback details (last 100)
        const recentSnap = await db.collection('nacho_feedback')
            .orderBy('ts', 'desc')
            .limit(100)
            .get();

        // Analyze sources and common questions
        const sources = {};
        const downvotedQuestions = [];
        recentSnap.forEach(doc => {
            const d = doc.data();
            const src = d.source || 'unknown';
            sources[src] = (sources[src] || 0) + 1;
            if (d.rating === -1 && d.question) {
                downvotedQuestions.push(d.question.substring(0, 80));
            }
        });

        // Build report
        const sourceList = Object.entries(sources)
            .sort((a, b) => b[1] - a[1])
            .map(([s, c]) => `  ${s}: ${c}`)
            .join('\n');

        const downvotedList = downvotedQuestions.length > 0
            ? downvotedQuestions.slice(0, 10).map(q => `  • ${q}`).join('\n')
            : '  None!';

        const report = {
            title: '📊 Nacho Feedback Report',
            total,
            thumbsUp,
            thumbsDown,
            satisfaction: satisfaction + '%',
            newSinceLastReport: total - lastReportedTotal,
            sources: sourceList,
            downvotedQuestions: downvotedList,
            generatedAt: new Date().toISOString(),
        };

        // Store report
        await db.collection('analytics').doc('nacho_feedback').update({
            lastReportedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastReportedTotal: total,
            lastReport: report,
        });

        // Store in reports collection for history
        await db.collection('nacho_feedback_reports').add({
            ...report,
            ts: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log('Nacho feedback report generated:', JSON.stringify(report));
        return null;
    } catch(e) {
        console.error('Feedback report error:', e);
        return null;
    }
});

// =============================================
// AUDIT FIX: Referral Verification
// Runs when a referred user meets qualifications
// Uses admin SDK to update the referrer's document
// =============================================
// Referral payouts are server-side. The old client path looked up `referredUid`
// and paid 50 tickets from the referrer's browser; rules blocked that write, so
// nobody was ever paid. This callable now only pays the signed-in referee, once.
exports.verifyReferral = functionsV1.runWith({ secrets: [referralIpSecret] }).https.onCall(async (data, context) => {
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    const result = await referralService.payIfQualified(context.auth.uid);
    if (result && result.paid && result.referrerUid) {
        try {
            await sendUserPush(result.referrerUid, 'referrals', {
                title: 'Referral reward',
                body: 'Someone you invited reached Maxi. 50 Orange Tickets were added.',
                url: 'https://bitcoineducation.quest/#questhub'
            });
        } catch (e) {
            console.warn('[verifyReferral] push failed', e.message);
        }
    }
    return {
        success: !!(result && result.paid),
        reason: result && result.reason,
        referrerTickets: result && result.paid ? result.ticketsEach : 0,
        referredTickets: result && result.paid ? result.ticketsEach : 0,
    };
});

exports.registerReferral = functionsV1.runWith({ secrets: [referralIpSecret] }).https.onCall(async (data, context) => {
    return referralService.registerReferral(data, context);
});

exports.deleteMyReferralSignal = functionsV1.https.onCall(async (data, context) => {
    return referralService.deleteMyReferralSignal(data, context);
});

exports.confirmTipSent = functionsV1.https.onCall(async (data, context) => {
    return tipService.confirmTipSent(data, context);
});

exports.requestTipInvoice = functionsV1.https.onCall(async (data, context) => {
    return tipService.requestTipInvoice(data, context);
});

exports.onUserReferral = onDocumentWritten({
    document: 'users/{uid}',
    secrets: [referralIpSecret],
}, async (event) => {
    return referralService.onUserWritten(event);
});

exports.payQualifiedReferrals = onSchedule({
    schedule: 'every 60 minutes',
    timeZone: 'UTC',
    secrets: [referralIpSecret],
}, async () => {
    return referralService.scanPending(40);
});


// =============================================
// NOTE: Old allowedAwards-based awardPoints removed - replaced by daily-cap version below (line ~1527)
// That version enforces the shared 1,000 XP/day cap (full through 500, half through 900, then a quarter) via daily_points

// =============================================
// AUDIT FIX: Server-Side Daily Limit Check
// Spin wheel, scholar exam, quest attempts
// =============================================
exports.checkDailyLimit = functionsV1.https.onCall(async (data, context) => {
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');

    const uid = context.auth.uid;
    const action = data.action || '';
    const today = new Date().toISOString().split('T')[0];
    const userRef = db.collection('users').doc(uid);

    const allowedActions = {
        'spin': { max: 1, field: 'lastSpinDate' },
        'scholar_exam': { max: 1, field: 'lastScholarDate' },
        'quest': { max: 3, field: 'questDate', countField: 'questCountToday' }
    };

    if (!allowedActions[action]) {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Invalid action');
    }

    const config = allowedActions[action];

    try {
        const result = await db.runTransaction(async (t) => {
            const userDoc = await t.get(userRef);
            if (!userDoc.exists) throw new Error('NOT_FOUND');

            const userData = userDoc.data();
            const lastDate = userData[config.field] || '';

            if (config.countField) {
                // Count-based limit (quests)
                const count = (lastDate === today) ? (userData[config.countField] || 0) : 0;
                if (count >= config.max) {
                    return { allowed: false, reason: 'Daily limit reached (' + config.max + '/' + config.max + ')' };
                }
                t.update(userRef, {
                    [config.field]: today,
                    [config.countField]: (lastDate === today) ? admin.firestore.FieldValue.increment(1) : 1
                });
            } else {
                // Simple date-based limit (spin, exam)
                if (lastDate === today) {
                    return { allowed: false, reason: 'Already done today. Come back tomorrow!' };
                }
                t.update(userRef, { [config.field]: today });
            }
            return { allowed: true };
        });
        return result;
    } catch (e) {
        if (e.message === 'NOT_FOUND') {
            throw new functionsV1.https.HttpsError('not-found', 'User not found');
        }
        console.error('[CHECK_DAILY_LIMIT_TRANS_ERR]', e);
        throw new functionsV1.https.HttpsError('internal', 'Internal transaction error');
    }
});

// =============================================
// AUDIT FIX: Forum Content Moderation
// Server-side profanity filter with leetspeak detection
// =============================================
exports.moderateContent = functionsV1.https.onCall(async (data, context) => {
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');

    const text = (data.text || '').trim();
    if (!text) return { clean: true };

    // Normalize leetspeak
    const normalized = text.toLowerCase()
        .replace(/[@4]/g, 'a')
        .replace(/[8]/g, 'b')
        .replace(/[3€]/g, 'e')
        .replace(/[1!|]/g, 'i')
        .replace(/[0]/g, 'o')
        .replace(/[$5]/g, 's')
        .replace(/[7+]/g, 't')
        .replace(/[*._\-]/g, '')
        .replace(/\s+/g, ' ');

    const profanityList = [
        'fuck', 'shit', 'bitch', 'asshole', 'damn', 'cunt',
        'dick', 'cock', 'pussy', 'whore', 'slut', 'fag',
        'nigger', 'nigga', 'retard', 'kill yourself', 'kys'
    ];

    // Word boundary matching to avoid Scunthorpe problem
    for (const word of profanityList) {
        const regex = new RegExp('\\b' + word + '\\b', 'i');
        if (regex.test(normalized)) {
            return { clean: false, reason: 'Content contains inappropriate language' };
        }
    }

    // Check for scam patterns
    const scamPatterns = [
        /send me \d+ btc/i,
        /double your bitcoin/i,
        /guaranteed.*return/i,
        /invest.*guaranteed/i,
        /free bitcoin.*send/i,
    ];

    for (const pattern of scamPatterns) {
        if (pattern.test(text)) {
            return { clean: false, reason: 'Content contains potential scam patterns' };
        }
    }

    return { clean: true };
});


// =============================================
// [C1] SECURE TELEGRAM BRIDGE
// Bridge secret lives here, NOT in client code
// =============================================
const {
    postToTelegramBridge,
    buildWebBridgePayload,
    redactForLog,
    WEB_BRIDGE_TIMEOUT_MS,
    mirrorShoutoutOnce,
} = require('./src/telegramBridge');

exports.bridgeToTelegram = functionsV1.https.onCall(async (data, context) => {
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    if (!data.text && !data.gifUrl && !data.imageUrl && !data.imageBase64) {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Missing content');
    }

    // Server-side content filtering - prevents bypassing client-side filters via direct CF calls
    if (data.text) {
        const text = data.text.toLowerCase()
            .replace(/0/g,'o').replace(/1/g,'i').replace(/3/g,'e').replace(/4/g,'a')
            .replace(/5/g,'s').replace(/7/g,'t').replace(/\$/g,'s').replace(/@/g,'a')
            .replace(/!/g,'i').replace(/\*/g,'').replace(/_/g,'').replace(/-/g,'');
        const BAD = ['fuck','shit','bitch','dick','cock','pussy','cunt','nigger','nigga','fag','faggot','retard',
            'nazi','hitler','kkk','porn','hentai','rape','pedo','slut','whore','cum','dildo','tits','nude','naked',
            'suicide','terrorist','jihad','genocide','lynch','blowjob','handjob','threesome','gangbang','bondage',
            'deepthroat','masturbat','hooker','stripper','onlyfans','pornhub','xvideos','xnxx',
            'spic','wetback','chink','gook','kike','towelhead','raghead','beaner','coon','darkie',
            'maga','trump','biden','democrat','republican','antifa','qanon','white power','sieg heil',
            'kill yourself','kys','kill myself','self harm','death to','gas the'];
        const words = text.split(/\s+/);
        for (const bad of BAD) {
            if (bad.includes(' ')) { if (text.includes(bad)) throw new functionsV1.https.HttpsError('invalid-argument', 'Message blocked by content filter'); }
            else { for (const w of words) { if (w === bad) throw new functionsV1.https.HttpsError('invalid-argument', 'Message blocked by content filter'); } }
            if (bad.length >= 4 && text.includes(bad)) throw new functionsV1.https.HttpsError('invalid-argument', 'Message blocked by content filter');
        }
    }

    // Rate limit: 1 bridge call per 3 seconds per user
    const uid = context.auth.uid;
        // Rate limit bridge: 3 seconds between calls (atomic transaction)
    const rateLimitRef = db.collection('rate_limits').doc('bridge_' + uid);
    await db.runTransaction(async (tx) => {
        const rateLimitDoc = await tx.get(rateLimitRef);
        if (rateLimitDoc.exists) {
            const lastCall = rateLimitDoc.data().lastCall;
            if (lastCall && Date.now() - (lastCall.toDate ? lastCall.toDate() : new Date(lastCall)).getTime() < 3000) {
                throw new functionsV1.https.HttpsError('resource-exhausted', 'Too fast - wait 3 seconds');
            }
        }
        tx.set(rateLimitRef, { lastCall: admin.firestore.FieldValue.serverTimestamp() });
    });

    // Secret lives ONLY in server-side environment variables (.env)
    const BRIDGE_SECRET = process.env.BRIDGE_SECRET;

    if (!BRIDGE_SECRET) {
        console.error('[BRIDGE] No bridge secret configured - run: firebase functions:config:set bridge.secret="YOUR_SECRET"');
        return { ok: false, error: 'Bridge not configured' };
    }

    try {
        // Look up the caller's actual username from Firestore (don't trust client-supplied name)
        let verifiedUsername = 'Anon';
        try {
            const userDoc = await db.collection('users').doc(uid).get();
            if (userDoc.exists && userDoc.data().username) {
                verifiedUsername = userDoc.data().username.substring(0, 50);
            }
        } catch(e) {}

        // The client-supplied name is ignored. The worker renders payload.user as "[🌐 name]".
        const payload = buildWebBridgePayload(verifiedUsername, uid, data);
        const json = await postToTelegramBridge(payload, {
            secret: BRIDGE_SECRET,
            timeoutMs: WEB_BRIDGE_TIMEOUT_MS,
        });

        // Store telegramMsgId if returned by bridge worker
        if (json.telegramMsgId && json.chatId) {
            try {
                // The caller should pass the Firestore message ID as data.messageId
                if (data.messageId) {
                    const msgRef = db.collection('global_chat').doc(data.messageId);
                    const msgDoc = await msgRef.get();
                    if (!msgDoc.exists || msgDoc.data().uid !== uid) {
                        console.warn('[BRIDGE] telegramMsgId stamp rejected: caller does not own message', data.messageId);
                    } else {
                        await msgRef.update({
                            telegramMsgId: json.telegramMsgId.toString(),
                            telegramChatId: json.chatId.toString()
                        });
                    }
                }
            } catch (e) {
                console.log('[BRIDGE] Could not store telegramMsgId:', e.message);
            }
        }

        return { ok: json.ok || false, telegramMsgId: json.telegramMsgId };
    } catch(e) {
        console.error('[BRIDGE] Error:', redactForLog(e && e.message, BRIDGE_SECRET));
        return { ok: false };
    }
});

// ===== SATS FAUCET - claimSats Cloud Function =====
// Lookup retries can run about two minutes, so the timeout sits above that.
exports.claimSats = functionsV1.runWith({
    timeoutSeconds: 300,
    enforceAppCheck: true,
}).https.onCall(async (data, context) => {
    await secondFactor.requireSecondFactor(secondFactor.stamp(data, context));
    if (!context.auth) {
        throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const uid = context.auth.uid;
    const email = context.auth.token.email;
    const emailVerified = context.auth.token.email_verified;

    if (!email || !emailVerified) {
        return { success: false, error: 'Verified email required. Link and verify your email in Account settings.' };
    }

    const tsToken = data.turnstileToken || '';
    const tsValid = await verifyTurnstile(tsToken, null);
    if (!tsValid) {
        console.warn('[FAUCET] Turnstile verification failed for uid:', uid);
        return { success: false, error: 'Security check failed. Please refresh and try again.' };
    }

    if (!FAUCET.NWC_URL) {
        console.error('[FAUCET] NWC_URL not configured');
        return { success: false, error: 'Faucet not configured. Contact admin.' };
    }

    // Banned accounts fail before any Lightning, IP, or fingerprint lookup.
    const userPreSnap = await db.collection('users').doc(uid).get();
    const ledgerPreSnap = await db.collection('faucet_ledger').doc(uid).get();
    const preBan = faucetGuard.assessBan(
        userPreSnap.exists ? userPreSnap.data() : {},
        ledgerPreSnap.exists ? ledgerPreSnap.data() : {}
    );
    if (!preBan.ok) return { success: false, error: preBan.error };

    if (data && typeof data === 'object') {
        data = Object.assign({}, data, { lightningAddress: normalizeLnAddress(data.lightningAddress) });
    }
    const addrReq = faucetGuard.requireLightningAddress(data || {});
    if (!addrReq.ok) return { success: false, error: addrReq.error };
    const lnNorm = addrReq.address;
    const amountReq = faucetGuard.assessClaimAmount(data && data.amount);
    if (!amountReq.ok) return { success: false, error: amountReq.error };
    const lnAddrAmount = amountReq.amount;

    let userRecord;
    try {
        userRecord = await admin.auth().getUser(uid);
        const creationDate = new Date(userRecord.metadata.creationTime);
        const ageDays = Math.floor((Date.now() - creationDate.getTime()) / 86400000);
        if (ageDays < FAUCET.MIN_ACCOUNT_AGE_DAYS) {
            return { success: false, error: 'Account must be at least ' + FAUCET.MIN_ACCOUNT_AGE_DAYS + ' days old. Yours is ' + ageDays + ' days.' };
        }
    } catch (e) {
        console.error('[FAUCET] Could not verify account age:', e.message);
        return { success: false, error: 'Could not verify account age. Try again later.' };
    }

    const configDoc = await db.collection('faucet_config').doc('settings').get();
    if (configDoc.exists && configDoc.data().paused) {
        return { success: false, error: 'Sats faucet is temporarily paused.' };
    }

    const _lnDomainRaw = lnNorm.split('@')[1] || '';
    const _lnDomain = _lnDomainRaw.split(':')[0].toLowerCase();
    const _isPrivateHost = (
        _lnDomain === 'localhost' ||
        /^127\./.test(_lnDomain) ||
        /^10\./.test(_lnDomain) ||
        /^192\.168\./.test(_lnDomain) ||
        /^172\.(1[6-9]|2[0-9]|3[01])\./.test(_lnDomain) ||
        /^169\.254\./.test(_lnDomain) ||
        /^::1$/.test(_lnDomain) ||
        /^fd[0-9a-f]{2}:/i.test(_lnDomain) ||
        /^\d+\.\d+\.\d+\.\d+$/.test(_lnDomain)
    );
    if (_isPrivateHost || !_lnDomain || _lnDomain.length < 3 || !_lnDomain.includes('.')) {
        console.error('[FAUCET] SSRF BLOCKED: domain=' + _lnDomain + ' uid=' + uid);
        return { success: false, error: 'Invalid Lightning Address domain.' };
    }

    let invoice = '';
    try {
        await assertPublicHost(_lnDomain);
        const resolved = await resolveLnurlInvoice({
            address: lnNorm,
            msats: lnAddrAmount * 1000,
        });
        invoice = resolved.pr;
        console.log('[FAUCET] Resolved Lightning Address for ' + lnAddrAmount + ' sats domain=' + resolved.domain);
    } catch (e) {
        console.error('[FAUCET] Lightning Address resolution failed domain=' + (_lnDomain || ''));
        const clear = e && (e.code === 'lnurl_error' || e.code === 'below_min' || e.code === 'above_max' || e.code === 'amount_mismatch' || e.code === 'wrong_network');
        return {
            success: false,
            code: 'address_unresolved',
            error: clear && e.message ? e.message : RESOLVE_ERROR,
        };
    }

    if (!invoice || !invoice.toLowerCase().startsWith('lnbc')) {
        return { success: false, error: 'Could not resolve Lightning Address. Check the address and try again.' };
    }
    if (invoice.length < 50 || invoice.length > 2000) {
        return { success: false, error: 'Invalid Lightning invoice length.' };
    }

    let decoded;
    try {
        decoded = bolt11.decode(invoice);
    } catch (e) {
        return { success: false, error: 'Invalid Lightning invoice format.' };
    }
    if (!decoded.network || decoded.network.bech32 !== 'bc') {
        return { success: false, code: 'address_unresolved', error: 'Invoice must be a mainnet Lightning invoice.' };
    }
    const amount = Math.floor((decoded.millisatoshis || 0) / 1000);
    if (!amount || amount !== lnAddrAmount) {
        return { success: false, error: 'Lightning Address returned an unexpected amount.' };
    }
    if (amount > faucetGuard.MAX_PER_CLAIM_SATS) {
        return { success: false, error: 'Claim exceeds maximum. Contact support.' };
    }
    if (decoded.timeExpireDate && decoded.timeExpireDate < Math.floor(Date.now() / 1000)) {
        return { success: false, error: 'Invoice has expired. Generate a fresh one.' };
    }

    const lookupReqEarly = faucetGuard.lookupRequestFromDecoded(decoded);
    const paymentHash = lookupReqEarly ? lookupReqEarly.payment_hash : '';
    const invoiceHash = require('crypto').createHash('sha256').update(invoice).digest('hex').substring(0, 32);
    const invoiceRef = db.collection('faucet_invoices').doc(invoiceHash);

    const clientIP = faucetGuard.clientIpFromRequest(context.rawRequest) || 'unknown';
    if (clientIP === 'unknown') {
        console.error('[FAUCET] Could not determine client IP for uid=' + uid);
        return { success: false, error: faucetGuard.supportError('Could not verify request origin.') };
    }
    const net = faucetGuard.networkKeys(clientIP);
    if (!net) {
        console.error('[FAUCET] Unparsed client IP for uid=' + uid);
        return { success: false, error: faucetGuard.supportError('Could not verify request origin.') };
    }

    const fingerprint = (data.fingerprint || '').trim();
    const fpId = faucetGuard.fingerprintDocId(fingerprint);
    if (!fpId) {
        console.warn('[FAUCET] FINGERPRINT MISSING: uid=' + uid);
        return { success: false, error: 'Device verification required.' };
    }

    const today = new Date().toISOString().split('T')[0];
    const userRef = db.collection('users').doc(uid);
    const dailyRef = userRef.collection('sats_daily').doc(today);
    const globalRef = db.collection('faucet_stats').doc(today);
    const ledgerRef = db.collection('faucet_ledger').doc(uid);
    const lockRef = db.collection('lightning_addresses').doc(lnNorm);
    const fpRef = db.collection('faucet_fingerprints').doc(fpId);
    const ipRef = db.collection('faucet_ip_log').doc(net.exactId);
    const subnetRef = db.collection('faucet_subnet_log').doc(net.rangeId);
    const lnRateRef = db.collection('faucet_ln_ratelimit').doc(faucetGuard.addressRateDocId(lnNorm));
    const signalRef = db.collection('faucet_uid_signals').doc(uid);

    let txFlag = null;
    let displayName = 'Bitcoiner';
    try {
        await db.runTransaction(async (t) => {
            txFlag = null;
            function deny(message, extra) {
                txFlag = extra || null;
                const err = new Error('FAUCET_USER:' + message);
                err.faucetExtra = extra || null;
                throw err;
            }

            const invoiceDoc = await t.get(invoiceRef);
            const userDoc = await t.get(userRef);
            const ledgerDoc = await t.get(ledgerRef);
            const dailyDoc = await t.get(dailyRef);
            const globalDoc = await t.get(globalRef);
            const lockDoc = await t.get(lockRef);
            const fpDoc = await t.get(fpRef);
            const ipDoc = await t.get(ipRef);
            const subnetDoc = await t.get(subnetRef);
            const lnRateDoc = await t.get(lnRateRef);

            if (invoiceDoc.exists) deny('This payout was already used. Wait a moment and try again.');
            if (!userDoc.exists) deny('User profile not found.');
            const user = userDoc.data();
            const ledger = ledgerDoc.exists ? ledgerDoc.data() : {};
            displayName = faucetGuard.publicDisplayName(user);

            const ban = faucetGuard.assessBan(user, ledger);
            if (!ban.ok) deny(ban.error);

            if (user._pendingClaim === true) {
                const pendingAt = user._pendingClaimAt
                    ? (user._pendingClaimAt.toDate ? user._pendingClaimAt.toDate() : new Date(user._pendingClaimAt))
                    : null;
                const PENDING_TTL_MS = 5 * 60 * 1000;
                if (pendingAt && (Date.now() - pendingAt.getTime() <= PENDING_TTL_MS)) {
                    deny('A previous claim is still processing. Try again in a minute.');
                }
                console.log('[FAUCET] Auto-clearing stale _pendingClaim for uid=' + uid);
            }

            let visitedList = Array.isArray(user.visitedChannelsList) ? user.visitedChannelsList : [];
            let visitedUpdate = null;
            if (visitedList.length < FAUCET.MIN_CHANNELS_READ) {
                const legacyRead = Array.isArray(user.readChannels) ? user.readChannels : [];
                if (legacyRead.length > visitedList.length) {
                    visitedUpdate = Array.from(new Set([].concat(
                        visitedList,
                        legacyRead.filter(function(c) {
                            return typeof c === 'string' && VALID_CHANNEL_IDS.has(c);
                        })
                    )));
                    visitedList = visitedUpdate;
                }
            }
            if (visitedList.length < FAUCET.MIN_CHANNELS_READ) {
                deny('Must read at least ' + FAUCET.MIN_CHANNELS_READ + ' channels. You have read ' + visitedList.length + '.');
            }

            const userPoints = user.points || 0;
            const availablePoints = userPoints - (user.pointsClaimed || 0) - (user.pointsDonated || 0) - (user.pointsExchanged || 0);
            const satsBalance = Math.floor(availablePoints / FAUCET.POINTS_PER_SAT);
            if (satsBalance < amount) {
                deny('Insufficient unclaimed points. You have ' + satsBalance + ' sats worth of unclaimed points (' + availablePoints + ' pts).');
            }

            const authCreation = new Date(userRecord.metadata.creationTime);
            const accountDays = Math.max(1, Math.floor((Date.now() - authCreation.getTime()) / 86400000));
            const maxReasonablePoints = (accountDays * 500) + 2100;
            if (userPoints > maxReasonablePoints) {
                console.error('[FAUCET] SUSPICIOUS (allowed): uid=' + uid + ' has ' + userPoints + ' pts but max reasonable=' + maxReasonablePoints + ' for ' + accountDays + ' day account');
            }

            const userSatsWithdrawn = user.satsWithdrawn || 0;
            const ledgerSatsWithdrawn = ledger.satsWithdrawn || 0;
            const satsWithdrawn = Math.max(userSatsWithdrawn, ledgerSatsWithdrawn);
            if (satsWithdrawn + amount > FAUCET.MAX_LIFETIME_PER_USER_SATS) {
                const remaining = FAUCET.MAX_LIFETIME_PER_USER_SATS - satsWithdrawn;
                deny('Lifetime cap reached. You can withdraw ' + remaining + ' more sats.');
            }

            const userLastClaim = _toMillis(user.lastSatsClaim);
            const ledgerLastClaim = _toMillis(ledger.lastSatsClaim);
            const lastClaim = Math.max(userLastClaim, ledgerLastClaim);
            if (lastClaim) {
                const cooldownEnd = lastClaim + (FAUCET.COOLDOWN_HOURS * 60 * 60 * 1000);
                if (Date.now() < cooldownEnd) {
                    const hoursLeft = Math.ceil((cooldownEnd - Date.now()) / 3600000);
                    deny('Cooldown active. Try again in ~' + hoursLeft + ' hour(s).');
                }
            }

            const dailyUsed = dailyDoc.exists ? (dailyDoc.data().amount || 0) : 0;
            if (dailyUsed + amount > FAUCET.MAX_DAILY_PER_USER_SATS) {
                const remaining = FAUCET.MAX_DAILY_PER_USER_SATS - dailyUsed;
                deny('Daily limit reached. You can claim ' + remaining + ' more sats today.');
            }

            const globalUsed = globalDoc.exists ? (globalDoc.data().totalPaid || 0) : 0;
            if (globalUsed + amount > FAUCET.GLOBAL_DAILY_MAX_SATS) {
                deny('Daily faucet limit reached. Try again tomorrow.');
            }

            const saved = faucetGuard.normalizeLightningAddress(user.lightningAddress || user.lightning || user.lnAddress || '');
            const lockOwner = lockDoc.exists ? String((lockDoc.data().uid || '')) : '';
            let lockOwnerBanned = false;
            let otherBanned = false;
            let otherUid = '';
            let otherName = '';
            if (lockOwner && lockOwner !== uid) {
                const otherDoc = await t.get(db.collection('users').doc(lockOwner));
                const otherLedger = await t.get(db.collection('faucet_ledger').doc(lockOwner));
                const otherUser = otherDoc.exists ? otherDoc.data() : {};
                otherUid = lockOwner;
                otherName = faucetGuard.publicDisplayName(otherUser);
                lockOwnerBanned = otherUser.satsDisabled === true || (otherLedger.exists && otherLedger.data().banned === true);
            } else if (!lockOwner) {
                const byAddress = await t.get(db.collection('users').where('lightningAddress', '==', lnNorm).limit(10));
                const byLightning = await t.get(db.collection('users').where('lightning', '==', lnNorm).limit(10));
                const byLn = await t.get(db.collection('users').where('lnAddress', '==', lnNorm).limit(10));
                const seen = {};
                [byAddress, byLightning, byLn].forEach(function(snap) {
                    snap.forEach(function(d) { if (d.id !== uid) seen[d.id] = d.data() || {}; });
                });
                const ids = Object.keys(seen);
                for (let i = 0; i < ids.length; i++) {
                    const led = await t.get(db.collection('faucet_ledger').doc(ids[i]));
                    if (seen[ids[i]].satsDisabled === true || (led.exists && led.data().banned === true)) {
                        otherBanned = true;
                        otherUid = ids[i];
                        otherName = faucetGuard.publicDisplayName(seen[ids[i]]);
                        break;
                    }
                }
            }
            const addrDecision = faucetGuard.assessAddressLock({
                callerUid: uid,
                requested: lnNorm,
                saved: saved,
                lockOwner: lockOwner,
                lockOwnerBanned: lockOwnerBanned,
                otherBanned: otherBanned,
            });
            if (!addrDecision.ok) {
                let flag = null;
                if (addrDecision.flag) {
                    flag = {
                        type: addrDecision.code === 'address_banned' ? 'banned_address' : 'locked_address_conflict',
                        uid: uid,
                        displayName: displayName,
                        otherUid: otherUid,
                        otherDisplayName: otherName,
                        detail: lnNorm,
                    };
                    console.error('[FAUCET] ADDRESS LOCK ' + addrDecision.code + ' addr owner=' + (lockOwner || otherUid) + ' uid=' + uid);
                }
                deny(addrDecision.error, flag);
            }

            const fpUids = fpDoc.exists ? (fpDoc.data().uids || []) : [];
            const fpDecision = faucetGuard.assessFingerprint(fpUids, uid);
            if (!fpDecision.ok) {
                console.error('[FAUCET] FINGERPRINT ABUSE fp=' + fpId + ' uid=' + uid + ' others=' + fpDecision.others.join(','));
                deny(fpDecision.error, {
                    type: 'fingerprint_abuse',
                    uid: uid,
                    displayName: displayName,
                    otherUid: fpDecision.others[0] || '',
                    detail: fpId,
                });
            }

            const nowMs = Date.now();
            const ipSlot = ipDoc.exists ? ipDoc.data() : {};
            const subnetSlot = subnetDoc.exists ? subnetDoc.data() : {};
            const ipDecision = faucetGuard.assessExactIpSlot({
                seen: ipSlot.seen || null,
                lastUid: ipSlot.lastUid || '',
                lastClaimMs: _toMillis(ipSlot.lastClaim),
            }, uid, nowMs);
            if (!ipDecision.ok) deny(ipDecision.error);
            const subnetDecision = faucetGuard.assessSubnetSlot({
                seen: subnetSlot.seen || null,
                lastUid: subnetSlot.lastUid || '',
                lastClaimMs: _toMillis(subnetSlot.lastClaim),
            }, uid, nowMs);
            if (!subnetDecision.ok) deny(subnetDecision.error);

            const priorClaims = lnRateDoc.exists ? (lnRateDoc.data().claims || []) : [];
            const rate = faucetGuard.assessAddressRate(priorClaims, nowMs);
            if (!rate.ok) deny(rate.error);

            const pointsToClaim = amount * FAUCET.POINTS_PER_SAT;
            const userUpdate = {
                pointsClaimed: admin.firestore.FieldValue.increment(pointsToClaim),
                satsWithdrawn: admin.firestore.FieldValue.increment(amount),
                lastSatsClaim: admin.firestore.FieldValue.serverTimestamp(),
                _pendingClaim: true,
                _pendingClaimAt: admin.firestore.Timestamp.now(),
                lightning: lnNorm,
                lightningAddress: lnNorm,
            };
            if (visitedUpdate) userUpdate.visitedChannelsList = visitedUpdate;
            t.update(userRef, userUpdate);
            t.set(ledgerRef, {
                satsWithdrawn: admin.firestore.FieldValue.increment(amount),
                lastSatsClaim: admin.firestore.FieldValue.serverTimestamp(),
                lastUid: uid,
                claimCount: admin.firestore.FieldValue.increment(1),
                firstClaim: ledgerDoc.exists ? (ledger.firstClaim || admin.firestore.FieldValue.serverTimestamp()) : admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            t.set(dailyRef, { amount: admin.firestore.FieldValue.increment(amount) }, { merge: true });
            t.set(globalRef, {
                totalPaid: admin.firestore.FieldValue.increment(amount),
                claimCount: admin.firestore.FieldValue.increment(1),
            }, { merge: true });
            t.set(invoiceRef, {
                uid: uid,
                amount: amount,
                status: 'pending',
                paymentHash: paymentHash,
                ts: admin.firestore.Timestamp.now(),
            });
            t.set(fpRef, {
                lastClaim: admin.firestore.FieldValue.serverTimestamp(),
                lastUid: uid,
                uids: admin.firestore.FieldValue.arrayUnion(uid),
                claimCount: admin.firestore.FieldValue.increment(1),
            }, { merge: true });
            t.set(ipRef, {
                lastClaim: admin.firestore.FieldValue.serverTimestamp(),
                lastUid: uid,
                seen: ipDecision.seen,
                uids: admin.firestore.FieldValue.delete(),
                claimCount: admin.firestore.FieldValue.increment(1),
            }, { merge: true });
            t.set(subnetRef, {
                lastClaim: admin.firestore.FieldValue.serverTimestamp(),
                lastUid: uid,
                label: net.rangeLabel,
                seen: subnetDecision.seen,
                uids: admin.firestore.FieldValue.delete(),
                claimCount: admin.firestore.FieldValue.increment(1),
            }, { merge: true });
            t.set(lnRateRef, {
                lastClaim: admin.firestore.FieldValue.serverTimestamp(),
                lastUid: uid,
                claims: rate.recent.concat([{ uid: uid, ts: nowMs, amount: amount }]),
            }, { merge: true });
            if (!lockDoc.exists) {
                t.set(lockRef, {
                    uid: uid,
                    address: lnNorm,
                    displayName: displayName,
                    lockedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
            t.set(signalRef, {
                uid: uid,
                displayName: displayName,
                fingerprint: fpId,
                subnet: net.rangeId,
                ipExact: net.exactId,
                lightningAddress: lnNorm,
                updatedAtMs: nowMs,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        });
    } catch (e) {
        const raw = e && e.message ? String(e.message) : '';
        const marker = 'FAUCET_USER:';
        const at = raw.indexOf(marker);
        if (at !== -1) {
            const extra = (e && e.faucetExtra) || txFlag;
            if (extra) await _flagFaucetAdmin(extra);
            return { success: false, error: raw.slice(at + marker.length) };
        }
        console.error('[FAUCET] Transaction failed:', raw);
        return { success: false, error: 'Claim validation failed. Please try again.' };
    }

    const payInfo = {
        uid: uid,
        amount: amount,
        invoice: invoice,
        invoiceRef: invoiceRef,
        userRef: userRef,
        address: lnNorm,
        paymentHash: paymentHash,
        displayName: displayName,
    };

    let nwc;
    let phase = 'balance';
    let payResult = null;
    let payError = null;
    try {
        nwc = new NWCClient({ nostrWalletConnectUrl: FAUCET.NWC_URL });
        const balanceResult = await _withTimeout(nwc.getBalance(), 20000, 'getBalance');
        const walletSats = Math.floor(balanceResult.balance / 1000);
        if (walletSats < FAUCET.WALLET_BALANCE_FLOOR_SATS) throw new Error('WALLET_LOW');
        if (amount > faucetGuard.MAX_PER_CLAIM_SATS) throw new Error('HARD_CAP');
        phase = 'pay';
        payResult = await _withTimeout(nwc.payInvoice({ invoice: invoice }), 30000, 'payInvoice');
        if (!payResult || !payResult.preimage) throw new Error('NO_PREIMAGE');
    } catch (e) {
        payError = e;
    }

    const decision = faucetGuard.decideFaucetPayment({ phase: phase, error: payError, payResult: payResult });
    if (decision.action === 'record') {
        try {
            await _recordFaucetPaid(Object.assign({}, payInfo, { preimage: decision.preimage }));
        } catch (e) {
            console.error('[FAUCET] paid but record failed:', e.message);
            await _notifyClaimedSats(uid, amount);
        try { await grantFamily(db, admin, uid, familyFor('satsWithdrawn')); }
        catch (satsBadgeErr) { console.warn('[FAUCET] sats badges', satsBadgeErr && satsBadgeErr.message); }
            return { success: true, amount: amount, preimage: decision.preimage, warning: faucetGuard.supportError('Paid, but the receipt did not save.') };
        }
        console.log('[FAUCET] Paid ' + amount + ' sats to ' + uid);
        await _notifyClaimedSats(uid, amount);
        try { await grantFamily(db, admin, uid, familyFor('satsWithdrawn')); }
        catch (satsBadgeErr) { console.warn('[FAUCET] sats badges', satsBadgeErr && satsBadgeErr.message); }
        return { success: true, amount: amount, preimage: decision.preimage, message: '⚡ ' + amount + ' sats sent to your wallet!' };
    }
    if (decision.action === 'refund') {
        await _rollbackClaim(uid, amount, today, invoiceRef);
        if (payError && payError.message === 'WALLET_LOW') {
            return { success: false, error: 'Faucet is being refilled. Try again later.' };
        }
        if (payError && payError.message === 'HARD_CAP') {
            return { success: false, error: 'Claim exceeds maximum. Contact support.' };
        }
        const isTimeout = payError && payError.message && payError.message.indexOf('[TIMEOUT]') === 0;
        if (phase !== 'pay') {
            return { success: false, error: isTimeout ? 'Payment wallet is not responding. Try again in a moment.' : 'Could not connect to payment wallet. Try again later.' };
        }
        return { success: false, error: 'Payment failed. Check your Lightning Address and try again.' };
    }

    const lookupReq = faucetGuard.lookupRequestFromDecoded(decoded);
    if (!lookupReq) {
        console.error('[FAUCET] ambiguous pay but the invoice has no payment hash uid=' + uid);
        try { await _holdFaucetUnknown(payInfo); }
        catch (e) { console.error('[FAUCET] could not hold unknown payment:', e.message); }
        return { success: false, error: _unknownPayError() };
    }

    console.error('[FAUCET] pay not confirmed (' + (payError && payError.message) + '). Looking up ' + lookupReq.payment_hash);
    const settlement = await faucetGuard.lookupSettlement({
        lookup: function() {
            return _withTimeout(nwc.lookupInvoice(lookupReq), 10000, 'lookupInvoice');
        },
        sleep: function(ms) {
            return new Promise(function(resolve) { setTimeout(resolve, ms); });
        },
    });
    const afterLookup = faucetGuard.decideFaucetLookupResult(settlement);
    if (afterLookup.action === 'record') {
        try {
            await _recordFaucetPaid(Object.assign({}, payInfo, { preimage: afterLookup.preimage, paymentHash: lookupReq.payment_hash }));
        } catch (e) {
            console.error('[FAUCET] settled but record failed:', e.message);
            await _notifyClaimedSats(uid, amount);
        try { await grantFamily(db, admin, uid, familyFor('satsWithdrawn')); }
        catch (satsBadgeErr) { console.warn('[FAUCET] sats badges', satsBadgeErr && satsBadgeErr.message); }
            return { success: true, amount: amount, preimage: afterLookup.preimage, warning: faucetGuard.supportError('Paid, but the receipt did not save.') };
        }
        console.log('[FAUCET] Lookup settled ' + amount + ' sats to ' + uid);
        await _notifyClaimedSats(uid, amount);
        try { await grantFamily(db, admin, uid, familyFor('satsWithdrawn')); }
        catch (satsBadgeErr) { console.warn('[FAUCET] sats badges', satsBadgeErr && satsBadgeErr.message); }
        return { success: true, amount: amount, preimage: afterLookup.preimage, message: '⚡ ' + amount + ' sats sent to your wallet!' };
    }
    if (afterLookup.action === 'refund') {
        await _rollbackClaim(uid, amount, today, invoiceRef);
        return { success: false, error: 'Payment failed. Your sats were not sent. Please try again.' };
    }

    try { await _holdFaucetUnknown(Object.assign({}, payInfo, { paymentHash: lookupReq.payment_hash })); }
    catch (e) { console.error('[FAUCET] could not hold unknown payment:', e.message); }
    return { success: false, error: _unknownPayError() };
});

function _unknownPayError() {
    return 'Payment status is unknown, so these sats were not refunded and the 24 hour cooldown still applies. Email support at ' + faucetGuard.SUPPORT_EMAIL + '.';
}

function _toMillis(v) {
    if (!v) return 0;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v.toDate === 'function') return v.toDate().getTime();
    const n = new Date(v).getTime();
    return Number.isFinite(n) ? n : 0;
}

function _withTimeout(promise, ms, label) {
    return Promise.race([
        promise,
        new Promise(function(_, reject) {
            setTimeout(function() {
                reject(new Error('[TIMEOUT] ' + label + ' timed out after ' + ms + 'ms'));
            }, ms);
        })
    ]);
}

async function _notifyClaimedSats(uid, amount) {
    await rewardNotify.safeCommit(db, admin.firestore.FieldValue.serverTimestamp(), rewardNotify.plan({
        uid: uid,
        sats: amount,
        sourceLabel: 'the sats faucet',
        icon: '⚡',
    }));
}

async function _rollbackClaim(uid, amount, today, invoiceRef) {
    try {
        const pointsToRefund = amount * FAUCET.POINTS_PER_SAT;
        const batch = db.batch();
        batch.update(db.collection('users').doc(uid), {
            pointsClaimed: admin.firestore.FieldValue.increment(-pointsToRefund),
            satsWithdrawn: admin.firestore.FieldValue.increment(-amount),
            _pendingClaim: admin.firestore.FieldValue.delete(),
            _pendingClaimAt: admin.firestore.FieldValue.delete()
        });
        batch.set(db.collection('faucet_ledger').doc(uid), {
            satsWithdrawn: admin.firestore.FieldValue.increment(-amount),
            claimCount: admin.firestore.FieldValue.increment(-1)
        }, { merge: true });
        batch.set(db.collection('users').doc(uid).collection('sats_daily').doc(today), {
            amount: admin.firestore.FieldValue.increment(-amount)
        }, { merge: true });
        batch.set(db.collection('faucet_stats').doc(today), {
            totalPaid: admin.firestore.FieldValue.increment(-amount),
            claimCount: admin.firestore.FieldValue.increment(-1)
        }, { merge: true });
        if (invoiceRef) batch.delete(invoiceRef);
        await batch.commit();
        console.log('[FAUCET] Rolled back ' + amount + ' sats for ' + uid);
    } catch (e) {
        console.error('[FAUCET] CRITICAL: Rollback failed for ' + uid + ', amount=' + amount + ':', e.message);
    }
}

async function _flagFaucetAdmin(flag) {
    if (!flag || !flag.type) return;
    try {
        await db.collection('faucet_admin_flags').add({
            type: String(flag.type).substring(0, 40),
            uid: String(flag.uid || '').substring(0, 128),
            displayName: faucetGuard.publicDisplayName({ username: flag.displayName }),
            otherUid: String(flag.otherUid || '').substring(0, 128),
            otherDisplayName: flag.otherDisplayName ? faucetGuard.publicDisplayName({ username: flag.otherDisplayName }) : '',
            detail: String(flag.detail || '').substring(0, 200),
            amount: Math.floor(Number(flag.amount) || 0),
            paymentHash: String(flag.paymentHash || '').substring(0, 80),
            createdAtMs: Date.now(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (e) {
        console.error('[FAUCET] flag write failed:', e.message);
    }
}

async function _recordFaucetPaid(info) {
    const batch = db.batch();
    batch.update(info.userRef, {
        _pendingClaim: admin.firestore.FieldValue.delete(),
        _pendingClaimAt: admin.firestore.FieldValue.delete(),
    });
    batch.set(info.userRef.collection('sats_withdrawals').doc(), {
        amount: info.amount,
        pointsUsed: info.amount * FAUCET.POINTS_PER_SAT,
        invoice: String(info.invoice || '').substring(0, 50) + '...',
        preimage: info.preimage || '',
        paymentHash: info.paymentHash || '',
        lightningAddress: info.address,
        status: 'paid',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        uid: info.uid,
    });
    batch.set(info.invoiceRef, {
        uid: info.uid,
        amount: info.amount,
        status: 'used',
        paymentHash: info.paymentHash || '',
        ts: admin.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();
}

async function _holdFaucetUnknown(info) {
    const batch = db.batch();
    batch.update(info.userRef, {
        _pendingClaim: admin.firestore.FieldValue.delete(),
        _pendingClaimAt: admin.firestore.FieldValue.delete(),
    });
    batch.set(info.invoiceRef, {
        uid: info.uid,
        amount: info.amount,
        status: 'unknown',
        paymentHash: info.paymentHash || '',
        ts: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    batch.set(info.userRef.collection('sats_withdrawals').doc(), {
        amount: info.amount,
        pointsUsed: info.amount * FAUCET.POINTS_PER_SAT,
        status: 'unknown',
        paymentHash: info.paymentHash || '',
        lightningAddress: info.address,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        uid: info.uid,
    });
    await batch.commit();
    await _flagFaucetAdmin({
        type: 'unknown_payment',
        uid: info.uid,
        displayName: info.displayName,
        amount: info.amount,
        paymentHash: info.paymentHash || '',
        detail: 'unknown',
    });
}

// Daily 13:00 UTC. One report, then an in-app note to admin-claim users.
// Also locks Lightning addresses found on banned accounts so a later claim
// cannot reuse them. It never overwrites a lock owned by someone else.
exports.dailyFaucetAbuseReport = onSchedule({
    schedule: '0 13 * * *',
    timeZone: 'UTC',
    timeoutSeconds: 300,
}, async () => {
    const now = Date.now();
    const start = now - faucetGuard.REPORT_WINDOW_MS;
    const startTs = admin.firestore.Timestamp.fromMillis(start);
    const day = new Date(now).toISOString().slice(0, 10);

    const bannedProfiles = await _loadBannedFaucetProfiles();
    await _lockBannedLightningAddresses(bannedProfiles);

    let claims = [];
    try {
        const signalsSnap = await db.collection('faucet_uid_signals').where('updatedAtMs', '>=', start).limit(500).get();
        claims = signalsSnap.docs.map(function(d) {
            const x = d.data() || {};
            return {
                uid: d.id,
                username: x.displayName || '',
                fingerprint: x.fingerprint || '',
                subnet: x.subnet || '',
                lightningAddress: x.lightningAddress || '',
                at: Number(x.updatedAtMs) || now,
            };
        });
    } catch (e) {
        console.error('[FAUCET-REPORT] signal query failed:', e.message);
    }

    const mates = [];
    const seenFp = {};
    const seenNet = {};
    for (let i = 0; i < claims.length; i++) {
        const c = claims[i];
        if (c.fingerprint && !seenFp[c.fingerprint]) {
            seenFp[c.fingerprint] = true;
            try {
                const fpDoc = await db.collection('faucet_fingerprints').doc(c.fingerprint).get();
                const uids = fpDoc.exists ? (fpDoc.data().uids || []) : [];
                uids.forEach(function(id) {
                    if (id && id !== c.uid) mates.push({ uid: id, username: '', fingerprint: c.fingerprint, at: c.at });
                });
            } catch (e) { console.error('[FAUCET-REPORT] fingerprint read failed:', e.message); }
        }
        if (c.subnet && !seenNet[c.subnet]) {
            seenNet[c.subnet] = true;
            try {
                const netDoc = await db.collection('faucet_subnet_log').doc(c.subnet).get();
                const uids = netDoc.exists ? (netDoc.data().uids || []) : [];
                uids.forEach(function(id) {
                    if (id && id !== c.uid) mates.push({ uid: id, username: '', subnet: c.subnet, at: c.at });
                });
            } catch (e) { console.error('[FAUCET-REPORT] subnet read failed:', e.message); }
        }
    }
    claims = claims.concat(mates);

    let signups = [];
    try {
        const signupSnap = await db.collection('users').where('created', '>=', startTs).limit(500).get();
        signups = signupSnap.docs.map(function(d) {
            const x = d.data() || {};
            return {
                uid: d.id,
                username: x.username || x.displayName || '',
                lightningAddress: faucetGuard.normalizeLightningAddress(x.lightningAddress || x.lightning || ''),
                at: x.created && x.created.toMillis ? x.created.toMillis() : now,
                satsDisabled: x.satsDisabled === true,
            };
        });
    } catch (e) {
        console.error('[FAUCET-REPORT] signup query failed:', e.message);
    }

    const uidSet = {};
    claims.forEach(function(c) { if (c.uid) uidSet[c.uid] = true; });
    signups.forEach(function(s) { if (s.uid) uidSet[s.uid] = true; });
    bannedProfiles.forEach(function(b) { if (b.uid) uidSet[b.uid] = true; });
    const allUids = Object.keys(uidSet);
    const users = {};
    const ledgers = {};
    for (let i = 0; i < allUids.length; i += 50) {
        const chunk = allUids.slice(i, i + 50);
        const userRefs = chunk.map(function(id) { return db.collection('users').doc(id); });
        const ledgerRefs = chunk.map(function(id) { return db.collection('faucet_ledger').doc(id); });
        const userSnaps = await db.getAll.apply(db, userRefs);
        const ledgerSnaps = await db.getAll.apply(db, ledgerRefs);
        userSnaps.forEach(function(doc) {
            if (!doc.exists) return;
            const x = doc.data() || {};
            users[doc.id] = {
                username: x.username || '',
                displayName: x.displayName || '',
                satsDisabled: x.satsDisabled === true,
                lightningAddress: faucetGuard.normalizeLightningAddress(x.lightningAddress || x.lightning || ''),
            };
        });
        ledgerSnaps.forEach(function(doc) {
            if (!doc.exists) return;
            ledgers[doc.id] = { banned: doc.data().banned === true };
        });
    }

    claims = claims.map(function(c) {
        const user = users[c.uid] || {};
        const ledger = ledgers[c.uid] || {};
        return {
            uid: c.uid,
            username: user.username || user.displayName || c.username || '',
            fingerprint: c.fingerprint || '',
            subnet: c.subnet || '',
            lightningAddress: c.lightningAddress || user.lightningAddress || '',
            at: c.at,
            banned: ledger.banned === true,
            satsDisabled: user.satsDisabled === true,
        };
    });
    signups = signups.map(function(s) {
        const user = users[s.uid] || {};
        const ledger = ledgers[s.uid] || {};
        return {
            uid: s.uid,
            username: user.username || user.displayName || s.username || '',
            lightningAddress: s.lightningAddress || user.lightningAddress || '',
            at: s.at,
            banned: ledger.banned === true,
            satsDisabled: user.satsDisabled === true || s.satsDisabled === true,
        };
    });

    const signalByUid = {};
    claims.forEach(function(c) {
        signalByUid[c.uid] = signalByUid[c.uid] || { fingerprint: '', subnet: '' };
        if (c.fingerprint) signalByUid[c.uid].fingerprint = c.fingerprint;
        if (c.subnet) signalByUid[c.uid].subnet = c.subnet;
    });
    const bannedAccounts = bannedProfiles.map(function(b) {
        const user = users[b.uid] || b;
        const signal = signalByUid[b.uid] || {};
        return {
            uid: b.uid,
            username: user.username || b.username || '',
            lightningAddress: user.lightningAddress || b.lightningAddress || '',
            fingerprint: signal.fingerprint || '',
            subnet: signal.subnet || '',
            banned: true,
            satsDisabled: user.satsDisabled === true || b.satsDisabled === true,
        };
    });

    const unknownPayments = [];
    const addressConflicts = [];
    try {
        const flagSnap = await db.collection('faucet_admin_flags').where('createdAtMs', '>=', start).limit(500).get();
        flagSnap.forEach(function(d) {
            const x = d.data() || {};
            if (x.type === 'unknown_payment') {
                unknownPayments.push({
                    uid: x.uid,
                    username: x.displayName,
                    amount: x.amount,
                    paymentHash: x.paymentHash,
                    at: x.createdAtMs,
                });
            } else if (x.type === 'locked_address_conflict' || x.type === 'banned_address') {
                addressConflicts.push({
                    uid: x.uid,
                    username: x.displayName,
                    otherUid: x.otherUid,
                    otherDisplayName: x.otherDisplayName,
                    address: x.detail,
                    at: x.createdAtMs,
                });
            }
        });
    } catch (e) {
        console.error('[FAUCET-REPORT] flag query failed:', e.message);
    }

    const report = faucetGuard.buildAbuseReport({
        now: now,
        claims: claims,
        signups: signups,
        bannedAccounts: bannedAccounts,
        unknownPayments: unknownPayments,
        addressConflicts: addressConflicts,
    });
    report.clusters = report.clusters.slice(0, 40).map(function(c) {
        return {
            kind: c.kind,
            key: c.kind === 'subnet' ? c.key : (c.kind === 'fingerprint' ? String(c.key).substring(0, 16) : c.key),
            bannedLink: c.bannedLink,
            accounts: c.accounts.slice(0, 12),
        };
    });

    await db.collection('faucet_abuse_reports').doc(day).set({
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        generatedAtMs: now,
        windowStartMs: report.windowStartMs,
        windowEndMs: report.windowEndMs,
        counts: report.counts,
        clusters: report.clusters,
        unknownPayments: report.unknownPayments.slice(0, 40),
        addressConflicts: report.addressConflicts.slice(0, 40),
    });

    const message = ('Faucet report ' + day + ': ' + report.counts.clusters + ' shared-account clusters, ' +
        report.counts.unknownPayments + ' unknown payments, ' + report.counts.addressConflicts +
        ' address locks. Open Settings, then Account.').substring(0, 180);
    const adminUids = await _listAdminClaimUids();
    for (let i = 0; i < adminUids.length; i++) {
        try {
            await db.collection('notifications').doc('faucet_abuse_' + day + '_' + adminUids[i]).set({
                recipientId: adminUids[i],
                senderId: 'system',
                senderName: 'Bitcoin Quest',
                type: 'security',
                message: message,
                targetType: 'faucet_abuse',
                targetId: day,
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        } catch (e) {
            console.error('[FAUCET-REPORT] notify failed:', e.message);
        }
    }
    console.log('[FAUCET-REPORT] wrote', day, 'clusters', report.counts.clusters, 'admins', adminUids.length);
});

// Ban from the in-app faucet report. The caller must hold the Firebase admin
// custom claim. adminBanUser (ADMIN_TOKEN header) is unchanged for other tools.
exports.banReportedFaucetUser = functionsV1.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    if (context.auth.token.admin !== true) {
        throw new functionsV1.https.HttpsError('permission-denied', 'Admin only');
    }
    const uid = String((data && data.uid) || '');
    if (!/^[A-Za-z0-9_-]{4,128}$/.test(uid)) {
        throw new functionsV1.https.HttpsError('invalid-argument', 'uid required');
    }
    const reason = String((data && data.reason) || 'faucet abuse report').substring(0, 200);
    const batch = db.batch();
    batch.update(db.collection('users').doc(uid), {
        withdrawals_disabled: true,
        satsDisabled: true,
        flagged: true,
        ban_reason: reason,
    });
    batch.set(db.collection('faucet_ledger').doc(uid), {
        banned: true,
        ban_reason: reason,
        bannedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await batch.commit();
    console.log('[banReportedFaucetUser] Banned uid:', uid);
    return { success: true, uid: uid };
});

async function _loadBannedFaucetProfiles() {
    const byUid = {};
    function take(id, data) {
        const x = data || {};
        const prev = byUid[id] || { uid: id, username: '', lightningAddress: '', satsDisabled: false };
        prev.username = prev.username || x.username || x.displayName || '';
        prev.lightningAddress = prev.lightningAddress || faucetGuard.normalizeLightningAddress(x.lightningAddress || x.lightning || '');
        if (x.satsDisabled === true) prev.satsDisabled = true;
        byUid[id] = prev;
    }
    try {
        const disabled = await db.collection('users').where('satsDisabled', '==', true).limit(300).get();
        disabled.forEach(function(d) { take(d.id, d.data()); });
    } catch (e) {
        console.error('[FAUCET-REPORT] satsDisabled query failed:', e.message);
    }
    try {
        const ledgers = await db.collection('faucet_ledger').where('banned', '==', true).limit(300).get();
        const missing = [];
        ledgers.forEach(function(d) {
            if (!byUid[d.id]) missing.push(d.id);
            else byUid[d.id].banned = true;
        });
        for (let i = 0; i < missing.length; i += 50) {
            const refs = missing.slice(i, i + 50).map(function(id) { return db.collection('users').doc(id); });
            const snaps = await db.getAll.apply(db, refs);
            snaps.forEach(function(doc) {
                take(doc.id, doc.exists ? doc.data() : {});
                if (byUid[doc.id]) byUid[doc.id].banned = true;
            });
        }
    } catch (e) {
        console.error('[FAUCET-REPORT] ledger ban query failed:', e.message);
    }
    return Object.keys(byUid).map(function(id) { return byUid[id]; });
}

async function _lockBannedLightningAddresses(profiles) {
    const list = profiles || [];
    for (let i = 0; i < list.length; i++) {
        const profile = list[i];
        const addr = faucetGuard.normalizeLightningAddress(profile.lightningAddress);
        if (!faucetGuard.validLightningAddress(addr)) continue;
        const ref = db.collection('lightning_addresses').doc(addr);
        try {
            let conflict = null;
            await db.runTransaction(async function(t) {
                const doc = await t.get(ref);
                if (!doc.exists) {
                    t.set(ref, {
                        uid: profile.uid,
                        address: addr,
                        displayName: faucetGuard.publicDisplayName(profile),
                        banned: true,
                        lockedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                    return;
                }
                const owner = String(doc.data().uid || '');
                if (owner && owner !== profile.uid) {
                    conflict = { owner: owner, ownerName: doc.data().displayName || '' };
                }
            });
            if (conflict) {
                await _flagFaucetAdmin({
                    type: 'locked_address_conflict',
                    uid: profile.uid,
                    displayName: profile.username,
                    otherUid: conflict.owner,
                    otherDisplayName: conflict.ownerName,
                    detail: addr,
                });
            }
        } catch (e) {
            console.error('[FAUCET-REPORT] lock failed:', e.message);
        }
    }
}

async function _listAdminClaimUids() {
    const uids = [];
    let pageToken;
    do {
        const page = await admin.auth().listUsers(1000, pageToken);
        page.users.forEach(function(u) {
            if (u.customClaims && u.customClaims.admin === true) uids.push(u.uid);
        });
        pageToken = page.pageToken;
    } while (pageToken);
    return uids;
}

// ===== PEER SYSTEM =====
// managePeer: send/accept/decline/cancel/remove peer connections.
// All mutations are CF-only; peer arrays on user docs are in the Firestore rules denylist.
exports.managePeer = functionsV1.https.onCall(async (data, context) => {
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    if (context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functionsV1.https.HttpsError('unauthenticated', 'Must use a real account to connect with peers');
    }

    const uid = context.auth.uid;
    const action = (data.action || '').toString().trim();
    const targetUid = (data.targetUid || '').toString().trim();

    if (!['send','accept','decline','cancel','remove'].includes(action)) {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Unknown action');
    }
    if (!targetUid || targetUid.length < 4 || targetUid.length > 128) {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Invalid targetUid');
    }
    if (uid === targetUid) {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Cannot peer with yourself');
    }

    const userRef    = db.collection('users').doc(uid);
    const targetRef  = db.collection('users').doc(targetUid);
    const reqId      = uid + '_' + targetUid;       // outgoing from uid
    const revReqId   = targetUid + '_' + uid;       // outgoing from targetUid
    const reqRef     = db.collection('peer_requests').doc(reqId);
    const revReqRef  = db.collection('peer_requests').doc(revReqId);

    // ── SEND ──────────────────────────────────────────────────────────────────
    if (action === 'send') {
        // These five reads do not depend on each other. One round trip.
        const [userDoc, targetDoc, outSnap, existDoc, revDoc] = await Promise.all([
            userRef.get(),
            targetRef.get(),
            db.collection('peer_requests')
                .where('from', '==', uid).where('status', '==', 'pending').limit(51).get(),
            reqRef.get(),
            revReqRef.get(),
        ]);
        if (!userDoc.exists)   throw new functionsV1.https.HttpsError('not-found', 'Your account not found');
        if (!targetDoc.exists) throw new functionsV1.https.HttpsError('not-found', 'Target user not found');

        const ud = userDoc.data();
        const td = targetDoc.data();

        if ((ud.peers || []).includes(targetUid)) {
            throw new functionsV1.https.HttpsError('already-exists', 'Already peers');
        }

        // Rate-limit: max 50 pending outgoing requests
        if (outSnap.size >= 50) {
            throw new functionsV1.https.HttpsError('resource-exhausted',
                'Too many pending peer requests. Cancel some first.');
        }

        // Check for existing requests in either direction
        if (existDoc.exists && existDoc.data().status === 'pending') {
            throw new functionsV1.https.HttpsError('already-exists', 'Peer request already sent');
        }
        if (revDoc.exists && revDoc.data().status === 'pending') {
            throw new functionsV1.https.HttpsError('already-exists',
                'This user already sent you a request — check your notifications');
        }

        const batch = db.batch();
        batch.set(reqRef, {
            from: uid, to: targetUid,
            fromUsername: ud.username || 'Bitcoiner',
            toUsername:   td.username || 'Bitcoiner',
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Same fields as the previous notifications.add(); the id is still random.
        batch.set(db.collection('notifications').doc(), {
            recipientId: targetUid,
            senderId: uid,
            senderName: ud.username || 'Bitcoiner',
            type: 'peer_request',
            message: (ud.username || 'Someone') + ' sent you a peer request ⚡',
            targetType: 'peer_request',
            targetId: reqId,
            fromUid: uid,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await batch.commit();
        try {
            await sendUserPush(targetUid, 'gifts', {
                title: 'Peer request',
                body: (ud.username || 'A Bitcoiner') + ' sent you a peer request.',
                url: 'https://bitcoineducation.quest/#questhub'
            });
        } catch (e) { console.warn('[managePeer] push failed', e.message); }
        return { success: true };
    }

    // ── ACCEPT ─────────────────────────────────────────────────────────────────
    if (action === 'accept') {
        // The request was sent from targetUid TO uid, so the doc is revReqRef.
        // The accepter's username is only needed for the notification, so it
        // can be read in the same round trip. Badge counts are read after
        // commit so peerCount includes this accept.
        const [revDoc, userDoc] = await Promise.all([revReqRef.get(), userRef.get()]);
        if (!revDoc.exists || revDoc.data().status !== 'pending') {
            throw new functionsV1.https.HttpsError('not-found', 'Peer request not found or already handled');
        }
        if (revDoc.data().to !== uid) {
            throw new functionsV1.https.HttpsError('permission-denied', 'Not your request to accept');
        }

        const ud = userDoc.exists ? userDoc.data() : {};
        const batch = db.batch();
        batch.update(revReqRef, { status: 'accepted', acceptedAt: admin.firestore.FieldValue.serverTimestamp() });
        batch.update(userRef,   { peers: admin.firestore.FieldValue.arrayUnion(targetUid), peerCount: admin.firestore.FieldValue.increment(1) });
        batch.update(targetRef, { peers: admin.firestore.FieldValue.arrayUnion(uid),       peerCount: admin.firestore.FieldValue.increment(1) });
        batch.set(db.collection('notifications').doc(), {
            recipientId: targetUid,
            senderId: uid,
            senderName: ud.username || 'Bitcoiner',
            type: 'peer_accepted',
            message: (ud.username || 'Someone') + ' accepted your peer request! 🧡',
            targetType: 'peer_accepted',
            targetId: revReqId,
            fromUid: uid,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await batch.commit();

        try {
            await sendUserPush(targetUid, 'gifts', {
                title: 'Peer request accepted',
                body: (ud.username || 'A Bitcoiner') + ' accepted your peer request.',
                url: 'https://bitcoineducation.quest/#questhub'
            });
        } catch (e) { console.warn('[managePeer] accept push failed', e.message); }

        // Peer badges are badge_awards rows (peer_1 and up), not the legacy badges array.
        try {
            await grantFamily(db, admin, uid, familyFor('peerCount'));
            await grantFamily(db, admin, targetUid, familyFor('peerCount'));
            await require('./src/badgeCredit').creditPeerAcceptXp(db, admin, uid, targetUid);
        } catch (peerBadgeErr) { console.warn('[managePeer] peer badges', peerBadgeErr && peerBadgeErr.message); }

        return { success: true };
    }

    // ── DECLINE ────────────────────────────────────────────────────────────────
    // The delete depends on this read (ownership). One read, one write.
    if (action === 'decline') {
        const revDoc = await revReqRef.get();
        if (!revDoc.exists) throw new functionsV1.https.HttpsError('not-found', 'Peer request not found');
        if (revDoc.data().to !== uid) throw new functionsV1.https.HttpsError('permission-denied', 'Not your request to decline');
        await revReqRef.delete();
        return { success: true };
    }

    // ── CANCEL (rescind own outgoing request) ──────────────────────────────────
    if (action === 'cancel') {
        const reqDoc = await reqRef.get();
        if (!reqDoc.exists) throw new functionsV1.https.HttpsError('not-found', 'Peer request not found');
        if (reqDoc.data().from !== uid) throw new functionsV1.https.HttpsError('permission-denied', 'Not your request to cancel');
        await reqRef.delete();
        return { success: true };
    }

    // ── REMOVE ─────────────────────────────────────────────────────────────────
    // Membership is checked on the caller doc, then both user updates and
    // both request deletes already commit in one batch.
    if (action === 'remove') {
        const userDoc = await userRef.get();
        if (!userDoc.exists) throw new functionsV1.https.HttpsError('not-found', 'User not found');
        const peers = userDoc.data().peers || [];
        if (!peers.includes(targetUid)) throw new functionsV1.https.HttpsError('not-found', 'Not peers');

        const batch = db.batch();
        batch.update(userRef,   { peers: admin.firestore.FieldValue.arrayRemove(targetUid), peerCount: admin.firestore.FieldValue.increment(-1) });
        batch.update(targetRef, { peers: admin.firestore.FieldValue.arrayRemove(uid),       peerCount: admin.firestore.FieldValue.increment(-1) });
        batch.delete(reqRef);
        batch.delete(revReqRef);
        await batch.commit();
        return { success: true };
    }
});

// ===== SERVER-SIDE POINTS AWARD (Fix #1, #2, #5) =====
// All point awards go through this Cloud Function instead of direct Firestore writes
// Enforces daily cap server-side, eliminates localStorage bypass and console inflation
exports.awardPoints = functionsV1.https.onCall(async (data, context) => {
    await secondFactor.requireSecondFactor(secondFactor.stamp(data, context));
    if (!context.auth) {
        throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const uid = context.auth.uid;
    const actionKey = (data.actionKey || '').substring(0, 50);
    const action = (data.action || data.reason || '').substring(0, 100);
    const channelId = (data.channelId || '').substring(0, 100);
    // This callable never grants tickets or streak freezes. Those stay on the
    // server flows that verify the grant themselves (referrals, daily spin,
    // visit milestones, donations, shop, gifts, ciphers, leaderboards).
    const tickets = 0;
    const streakFreezes = 0;
    // Badge ID for server-side dedup (optional - only sent for badge_earned actions)
    const badgeId = (data.badgeId || '').replace(/[^a-zA-Z0-9_\-]/g, '').substring(0, 60);

    // Correct/wrong is scored only by resolvePredictions. A hostile client must
    // not be able to grant itself the 25 XP prediction_correct award.
    if (actionKey === 'prediction_correct' || /prediction_correct|correct prediction|correct price prediction/i.test(action)) {
        return { success: false, error: 'Prediction results are scored on the server', awarded: 0 };
    }

    // PvP points, tickets, and W/L are granted inside settlePvpMatch from the
    // match document. A hostile client must not be able to call awardPoints
    // with a "PVP Victory" reason and mint XP with no match.
    if (pvpFlow.isClientPvpReward(actionKey, action)) {
        return { success: false, error: 'PvP rewards are granted by the server', awarded: 0 };
    }
    // Trivia and quiz XP are graded by answerTrivia / gradeQuest against the
    // server question bank. awardPoints must not pay a client claim.
    if (
        actionKey === 'trivia_correct' || actionKey === 'trivia_attempt' ||
        actionKey === 'quest_complete' || actionKey === 'quest_retry' || actionKey === 'quest_partial' ||
        /trivia[_\s-]*quest[_\s-]*correct|trivia_correct|trivia[_\s-]*quest[_\s-]*attempt|trivia_attempt/i.test(action)
    ) {
        return { success: false, error: 'Quiz and trivia rewards are graded on the server', awarded: 0 };
    }

    // ── SERVER-SIDE BADGE VALUE CATALOG ──
    // Every badge the client can earn mapped to its exact XP value.
    // If a badgeId is not in this map it is rejected - closes the money-printer exploit
    // where any badgeId minted the full 21,000 XP ceiling regardless of actual badge value.
    const BADGE_VALUES = {
        // Discovery / exploration
        first_channel: 10,
        explorer_10: 15, explorer_25: 30, explorer_50: 50, explorer_100: 100, explorer_all: 500,
        global_citizen: 100,
        // Daily Quest Hub
        quest_1: 10, quest_3: 25, quest_5: 50, quest_10: 100, quest_25: 200, quest_50: 400, quest_100: 750,
        // Certs
        cert_scholar: 50, cert_tech: 100, cert_double: 250, all_certs: 1500,
        // Timechain TV - watch time
        tctv_tuned_in: 10, tctv_couch_potato: 25, tctv_binge_watcher: 50, tctv_couch_king: 100, tctv_satellite: 750,
        // Timechain TV - channel switching
        tctv_channel_hopper: 5, tctv_remote_warrior: 10, tctv_dial_spinner: 15,
        tctv_signal_seeker: 25, tctv_antenna_wizard: 50, tctv_timechain_surfer: 100,
        // Nacho
        nacho_chatterbox: 30, nacho_bestie: 200, nacho_asked_10: 15, nacho_asked_100: 75,
        nacho_whisper: 500, nacho_eli5: 10,
        // Global chat
        chat_first: 10, chat_10: 15, chat_50: 25, chat_100: 50, chat_500: 250,
        chat_streak_3: 20, chat_streak_7: 50, chat_streak_30: 300,
        // DJ / Beats
        dj_first: 25, dj_5: 50, dj_25: 300, dj_songs_10: 30, dj_songs_50: 75, dj_songs_100: 400,
        dj_listener: 20, dj_listener_50: 150,
        producer_1: 50, producer_10: 100,
        beats_first_listen: 10, beats_50_plays: 30, beats_liked_10: 20, beats_liked_50: 75,
        // DMs
        dm_first: 15, dm_10: 25, dm_buddy: 30,
        // Reactions
        react_5: 10, react_50: 50, react_200: 150,
        // PVP
        pvp_first: 25, pvp_5: 50, pvp_25: 100, pvp_50: 200, pvp_100: 1000,
        // Referrals
        referral_1: 50, referral_5: 100, referral_10: 200, referral_25: 500,
        referral_50: 1000, referral_100: 2500, referred: 25,
        // Satoshi's Favor (SF)
        sf_first_hash: 10, sf_10_hashes: 25, sf_50_hashes: 75, sf_100_hashes: 150,
        sf_500_hashes: 500, sf_1000_hashes: 1000, sf_10000_hashes: 2100,
        sf_low_hash: 50, sf_ultra_low: 200, sf_block_solver: 1000,
        sf_contributor: 50, sf_contributor_10: 200,
        // Raid Boss
        raid_first: 10, raid_5: 50, raid_10: 100, raid_25: 250, raid_50: 750, raid_100: 1500,
        raid_boss_slayer: 50, raid_boss_slayer_5: 150, raid_boss_slayer_10: 500, raid_winner: 250,
        // Trivia
        trivia_first: 10, trivia_correct_1: 15, trivia_correct_10: 30,
        trivia_correct_30: 75, trivia_correct_100: 500,
        trivia_streak_7: 50, trivia_streak_30: 300,
        // Poll
        poll_first: 10, poll_10: 25, poll_50: 100, poll_100: 400,
        // Daily triple
        daily_triple_1: 25, daily_triple_7: 100, daily_triple_30: 500,
        // Marketplace
        market_browse: 10, market_listed_1: 30, market_listed_5: 75,
        market_saved_5: 15, market_message: 20,
        // Bookmarks / favs
        bookmarks_1: 10, bookmarks_10: 30, favs_10: 25, favs_25: 75,
        // Tips
        tip_first: 25, tip_10: 75, tip_magnet: 100, tip_whale: 150,
        tip_received_1: 20, tip_received_50: 500, tip_sats_10k: 300,
        // Price prediction
        predict_1: 10, predict_10: 25, predict_50: 75,
        predict_correct_5: 75, predict_correct_25: 200, predict_correct_100: 750,
        predict_streak_3: 50, predict_streak_10: 250,
        // IRL Sync
        irl_attend_1: 25, irl_attend_5: 100, irl_host: 50, irl_host_5: 150, irl_host_10: 500,
        // Spin wheel
        spin_30: 75, spin_streak_7: 50, spin_jackpot: 100,
        // Lightning
        lightning_setup: 100,
        // Forum / articles
        forum_5: 25, forum_25: 75, article_1: 50,
        // First purchase
        first_purchase: 10,
        // Sats milestones
        sats_first: 25, sats_1k: 100, sats_5k: 250, sats_10k: 500, sats_21k: 2100,
        // Streaks
        streak_7: 50, streak_14: 75, streak_30: 150, streak_60: 400,
        streak_100: 1000, streak_200: 2100, streak_365: 5000,
        // Nacho story
        story_begun: 15, story_halfway: 50, story_complete: 150,
        // Trails
        trail_meadow: 200, trail_mountain: 400, trail_summit: 750, trail_all: 500,
        // Learning Quests — per-topic badges
        lq_what_is_bitcoin: 100, lq_mining: 100, lq_nodes: 100, lq_self_custody: 100,
        lq_lightning: 100, lq_scarcity: 100, lq_bitcoin_only: 100, lq_privacy: 100,
        lq_graduate: 250,
        // FLEX aggregate badges
        flex_rookie: 25, flex_committed: 75, flex_athlete: 200, flex_legend: 1000, flex_all_once: 150,
        // FLEX per-action milestone badges (action_id × milestone)
        flex_steak_1: 2, flex_steak_5: 10, flex_steak_50: 100, flex_steak_500: 1000,
        flex_sunlight_1: 2, flex_sunlight_5: 10, flex_sunlight_50: 100, flex_sunlight_500: 1000,
        flex_dca_1: 2, flex_dca_5: 10, flex_dca_50: 100, flex_dca_500: 1000,
        flex_custody_1: 2, flex_custody_5: 10, flex_custody_50: 100, flex_custody_500: 1000,
        flex_lift_1: 2, flex_lift_5: 10, flex_lift_50: 100, flex_lift_500: 1000,
        flex_meetup_1: 2, flex_meetup_5: 10, flex_meetup_50: 100, flex_meetup_500: 1000,
        flex_lightning_1: 2, flex_lightning_5: 10, flex_lightning_50: 100, flex_lightning_500: 1000,
        flex_read_1: 2, flex_read_5: 10, flex_read_50: 100, flex_read_500: 1000,
        flex_sleep_1: 2, flex_sleep_5: 10, flex_sleep_50: 100, flex_sleep_500: 1000,
        flex_nokyc_1: 2, flex_nokyc_5: 10, flex_nokyc_50: 100, flex_nokyc_500: 1000,
        flex_node_1: 2, flex_node_5: 10, flex_node_50: 100, flex_node_500: 1000,
        flex_cold_1: 2, flex_cold_5: 10, flex_cold_50: 100, flex_cold_500: 1000,
        flex_fast_1: 2, flex_fast_5: 10, flex_fast_50: 100, flex_fast_500: 1000,
        flex_walk_1: 2, flex_walk_5: 10, flex_walk_50: 100, flex_walk_500: 1000,
        flex_journal_1: 2, flex_journal_5: 10, flex_journal_50: 100, flex_journal_500: 1000,
        flex_meditate_1: 2, flex_meditate_5: 10, flex_meditate_50: 100, flex_meditate_500: 1000,
        flex_teach_1: 2, flex_teach_5: 10, flex_teach_50: 100, flex_teach_500: 1000,
        flex_water_1: 2, flex_water_5: 10, flex_water_50: 100, flex_water_500: 1000,
        flex_gratitude_1: 2, flex_gratitude_5: 10, flex_gratitude_50: 100, flex_gratitude_500: 1000,
        flex_verify_1: 2, flex_verify_5: 10, flex_verify_50: 100, flex_verify_500: 1000,
        flex_focus_1: 2, flex_focus_5: 10, flex_focus_50: 100, flex_focus_500: 1000,
        flex_risk_1: 2, flex_risk_5: 10, flex_risk_50: 100, flex_risk_500: 1000,
        flex_pattern_1: 2, flex_pattern_5: 10, flex_pattern_50: 100, flex_pattern_500: 1000,
        flex_findq_1: 2, flex_findq_5: 10, flex_findq_50: 100, flex_findq_500: 1000,
        flex_noleverage_1: 2, flex_noleverage_5: 10, flex_noleverage_50: 100, flex_noleverage_500: 1000,
        flex_gunrange_1: 2, flex_gunrange_5: 10, flex_gunrange_50: 100, flex_gunrange_500: 1000,
        flex_sellchairs_1: 2, flex_sellchairs_5: 10, flex_sellchairs_50: 100, flex_sellchairs_500: 1000,
        flex_starebtc_1: 2, flex_starebtc_5: 10, flex_starebtc_50: 100, flex_starebtc_500: 1000,
        flex_itoldyou_1: 2, flex_itoldyou_5: 10, flex_itoldyou_50: 100, flex_itoldyou_500: 1000,
        flex_pumpndump_1: 2, flex_pumpndump_5: 10, flex_pumpndump_50: 100, flex_pumpndump_500: 1000,
        // FLEX all-daily milestone badges
        flex_all_1: 25, flex_all_5: 100, flex_all_50: 500, flex_all_500: 5000,
        // Donation (charity) badges
        donor_100: 50, donor_500: 150, donor_1000: 300, donor_5000: 1000,
        donor_10000: 2000, donor_25000: 4000, donor_50000: 7500, donor_100000: 15000,
        // Proof of Walk
        pow_first_step: 50, pow_marathoner: 200,
        pow_streak_3: 100, pow_streak_7: 300, pow_streak_30: 1000,
        pow_km_10: 50, pow_km_50: 100, pow_km_100: 200, pow_km_500: 500,
        pow_km_1000: 1000, pow_km_5000: 2500,
        // Milestones (lifetime)
        hall_of_fame: 5000, the_archive: 10000, genesis_block: 15000,
        satoshis_ghost: 21000, block_250: 25000, the_hodler: 30000,
        satoshis_covenant: 42000, satoshis_cipher: 100000,
        // Daily challenge badges
        daily_1: 25, daily_5: 50, daily_10: 100, daily_25: 250, daily_50: 500, daily_100: 1000,
        // Combo badges
        combo_trio: 50, combo_mega: 100, combo_legend: 250,
        // Weekly community challenge
        weekly_hero: 100,
        // Badge set completion bonuses
        set_miner_complete: 500, set_scholar_complete: 500, set_social_complete: 500,
        set_streak_complete: 1000, set_pvp_complete: 750, set_builder_complete: 500,
        set_explorer_complete: 500, set_fun_complete: 300,
        // ── Previously missing badge IDs (added 2026-07-21 to prevent CF rejection + re-fire loop) ──
        // Onboarding / profile
        first_save: 50, ghost_mode: 0, nacho_quester: 50,
        bio_author: 50, lightning_address_set: 75,
        profile_curious: 25, profile_explorer_5: 50, profile_explorer_10: 75,
        profile_explorer_25: 100, profile_explorer_50: 150, profile_explorer_100: 300,
        nacho_dressed: 15,
        // Exploration
        explorer_5: 10, explorer_25: 30, explorer_50: 50, explorer_100: 100, explorer_all: 500,
        foundation_builder: 75, experienced_pro: 150, librarian: 150,
        bookmarks_10: 30, bookworm: 20, favs_10: 25, favs_25: 75,
        early_bird: 15, night_owl: 15,
        // Quests
        quest_3: 25, quest_5: 50, quest_10: 100, quest_25: 200, quest_50: 400, quest_100: 750,
        // Certs / scholar
        cert_tech: 100, cert_double: 250, all_certs: 1500,
        // Chat extras
        chat_10: 15, chat_25: 20, chat_50: 25, chat_100: 50, chat_200: 100,
        chat_500: 250, chat_1000: 750, chat_first: 10,
        chat_lurker_5: 10, chat_lurker_10: 25, chat_lurker_50: 50, chat_lurker_100: 100, chat_lurker_500: 500,
        chat_streak_7: 50, chat_streak_30: 300,
        lb_lurker_5: 10, lb_lurker_10: 25, lb_lurker_50: 50, lb_lurker_100: 100, lb_lurker_500: 500,
        // DJ / Beats
        dj_first: 25, dj_5: 50, dj_25: 300, dj_50: 750,
        dj_songs_10: 30, dj_songs_50: 75, dj_songs_100: 400,
        dj_listener: 20, dj_listener_50: 150, dj_listener_100: 400,
        beats_50_plays: 30, beats_100_plays: 50, beats_200_plays: 75, beats_500_plays: 200,
        beats_liked_10: 20, beats_liked_50: 75, beats_comment_1: 15,
        producer_10: 100,
        // DMs
        dm_first: 15, dm_10: 25, dm_25: 50, dm_100: 200, dm_buddy: 30,
        // Forum / articles
        forum_first: 15, forum_10: 40, forum_50: 150, forum_100: 400,
        forum_reply_1: 10, forum_reply_10: 40,
        article_1: 50, article_5: 150, article_10: 400,
        // Daily / trifecta
        daily_5: 50, daily_10: 100, daily_25: 250, daily_50: 500,
        daily_triple_7: 100, daily_triple_30: 500, daily_triple_90: 1500, daily_triple_365: 5000,
        // Combos
        combo_mega: 100, combo_legend: 250,
        // Reactions
        react_10: 15, react_50: 50, react_100: 75, react_200: 150, react_500: 300,
        // PVP extras
        pvp_5: 50, pvp_25: 100, pvp_50: 200, pvp_100: 1000,
        pvp_played_1: 10, pvp_played_10: 25, pvp_played_50: 75,
        pvp_win_streak_3: 75, pvp_win_streak_5: 150,
        // Raid extras
        raid_5: 50, raid_10: 100, raid_25: 250, raid_50: 750, raid_100: 1500,
        raid_boss_slayer_5: 150, raid_boss_slayer_10: 500, raid_winner: 250,
        // Trivia extras
        trivia_correct_1: 15, trivia_correct_10: 30, trivia_correct_100: 500,
        trivia_streak_7: 50, trivia_streak_30: 300,
        // Poll extras
        poll_10: 25, poll_50: 100, poll_100: 400,
        // Tips extras
        tip_10: 75, tip_magnet: 100, tip_whale: 150,
        tip_received_1: 20, tip_received_50: 500, tip_sats_10k: 300,
        // Sats milestones
        sats_first: 25, sats_1k: 100, sats_5k: 250, sats_10k: 500, sats_21k: 2100,
        // Streaks extras
        streak_3: 15, streak_14: 75, streak_21: 100, streak_30: 150, streak_60: 400,
        streak_100: 1000, streak_200: 2100, streak_365: 5000,
        // Trails extras
        trail_started: 25, trail_meadow: 200, trail_mountain: 400, trail_summit: 750, trail_all: 500,
        trail_double: 100, trail_speed_3: 150, trail_meadow_fast: 50,
        trail_perfectionist: 75, trail_revisit: 30,
        // TCTV extras
        tctv_tuned_in: 10, tctv_couch_potato: 25, tctv_binge_watcher: 50,
        tctv_couch_king: 100, tctv_satellite: 750,
        tctv_channel_hopper: 5, tctv_remote_warrior: 10, tctv_dial_spinner: 15,
        tctv_signal_seeker: 25, tctv_antenna_wizard: 50, tctv_timechain_surfer: 100,
        // Spin wheel
        spin_1: 10, spin_7: 20, spin_100: 250,
        spin_closet_1: 50, spin_closet_5: 150,
        spin_streak_7: 50, spin_streak_14: 75, spin_streak_30: 200,
        // SF extras
        sf_10_hashes: 25, sf_50_hashes: 75, sf_100_hashes: 150,
        sf_1000_hashes: 1000, sf_10000_hashes: 2100,
        sf_lucky_1: 25, sf_lucky_5: 75, sf_lucky_10: 150, sf_lucky_50: 400,
        sf_lucky_100: 750, sf_lucky_1000: 2100,
        sf_unlucky_1: 15, sf_unlucky_5: 40, sf_unlucky_10: 75, sf_unlucky_50: 200,
        sf_unlucky_100: 400, sf_unlucky_1000: 1000,
        sf_ultra_low: 200, sf_block_solver: 1000,
        sf_first_hash: 10, sf_10_hashes: 25, sf_contributor_10: 200,
        // Nacho story
        story_begun: 15, story_halfway: 50, story_complete: 150,
        // Nacho interaction extras
        nacho_chatterbox: 30, nacho_bestie: 200, nacho_asked_10: 15, nacho_asked_100: 75,
        nacho_eli5: 10, nacho_whisper: 500,
        // Flex aggregate
        flex_committed: 75, flex_athlete: 200, flex_legend: 1000, flex_all_once: 150,
        flex_all_1: 25, flex_all_5: 100, flex_all_50: 500, flex_all_500: 5000,
        donor_100: 50, donor_500: 150, donor_1000: 300, donor_5000: 1000,
        donor_10000: 2000, donor_25000: 4000, donor_50000: 7500, donor_100000: 15000,
        // IRL extras
        irl_attend_1: 25, irl_attend_5: 100, irl_host: 50, irl_host_5: 150, irl_host_10: 500,
        // Marketplace extras
        market_browse: 10, market_listed_1: 30, market_listed_5: 75, market_listed_10: 150,
        market_saved_5: 15, market_message: 20,
        // Referrals
        referral_1: 50, referral_5: 100, referral_10: 200, referral_25: 500, referral_100: 2500,
        referred: 25,
        // Prediction
        predict_1: 10, predict_10: 25, predict_50: 75,
        predict_correct_25: 200, predict_correct_50: 400, predict_correct_100: 750,
        predict_accuracy_70: 200, predict_streak_3: 50, predict_streak_10: 250,
        // Fun / calendar
        fun_friday: 10, fun_weekend: 10, fun_midnight: 15, fun_new_year: 50,
        fun_bitcoin_birthday: 100, fun_halving_day: 100, fun_pi_day: 21, fun_whitepaper_day: 75,
        // Badge sets (additional)
        set_beats_complete: 500, set_daily_complete: 500, set_irl_complete: 500,
        set_lightning_complete: 750, set_pow_complete: 750, set_profile_complete: 500,
        set_spin_complete: 300, set_tctv_complete: 500, set_trails_complete: 500,
        set_trifecta_complete: 1000,
        // Special
        jack_of_all: 3000,
        // Learning Quests (check: () => false, server-only — keep at 0 so CF doesn't reject them)
        lq_what_is_bitcoin: 100, lq_mining: 100, lq_nodes: 100, lq_self_custody: 100,
        lq_lightning: 100, lq_scarcity: 100, lq_bitcoin_only: 100, lq_privacy: 100,
        lq_graduate: 250,
    };
    // FLEX per-action badge catalog - 23 actions × 8 milestones
    // Pattern: flex_<actionId>_<milestone>  → always 5 pts each
    const FLEX_ACTION_IDS = [
        'steak','sunlight','dca','custody','lift','meetup','lightning','read','sleep',
        'nokyc','node','cold','fast','walk','journal','meditate','teach','water',
        'gratitude','verify','focus','risk','pattern'
    ];
    const FLEX_MILESTONES = [1, 5, 10, 25, 50, 100, 500, 1000];
    for (const aid of FLEX_ACTION_IDS) {
        for (const m of FLEX_MILESTONES) {
            BADGE_VALUES['flex_' + aid + '_' + m] = 5;
        }
    }

// ── EXACT ACTION ALLOWLIST ──
    // Keyword and substring matching used to let any client phrase containing
    // "ticket" collect Orange Tickets. Amounts, per-day limits, and dedup keys
    // now come from awardActions. Client ticket counts are ignored.
    if (actionKey === 'onboarding_quest' || /nacho quest|onboarding quest/i.test(String(action || ''))) {
        return { success: false, error: 'Unknown action', awarded: 0, tickets: 0 };
    }
    const resolved = awardActions.resolveAction({
        actionKey: actionKey,
        action: action,
        badgeId: badgeId,
        channelId: channelId,
        flexActionId: data.flexActionId,
        comboTier: data.comboTier,
        pts: data.pts,
    });
    if (!resolved.ok) {
        return { success: false, error: resolved.error || 'Unknown action', awarded: 0, tickets: 0 };
    }

    let pts = resolved.xp;
    let matchedAction = resolved.id;
    let badgeKnown = false;
    if (resolved.badge) {
        const badgeResult = await awardBadge(db, admin, uid, badgeId, {
            day: getOffsetDateKey(),
            source: 'awardPoints',
            signedIn: !(context.auth.token && context.auth.token.firebase && context.auth.token.firebase.sign_in_provider === 'anonymous'),
        });
        if (!badgeResult || badgeResult.reason === 'unknown' || !badgeRules.isKnown(badgeResult.badgeId || badgeId)) {
            console.warn('[awardPoints] badge_earned rejected: unknown badgeId:', badgeId, 'uid:', uid);
            return { success: false, error: 'Unknown badge', awarded: 0, tickets: 0 };
        }
        if (badgeResult.cosmetic) {
            return { success: true, cosmetic: true, awarded: 0, tickets: 0 };
        }
        if (badgeResult.reason === 'criteria') {
            return { success: false, error: 'Badge condition not met', badgeConditionFailed: true, awarded: 0, tickets: 0 };
        }
        if (badgeResult.reason === 'banned') {
            return { success: true, awarded: 0, tickets: 0, banned: true };
        }
        if (badgeResult.reason === 'already' || badgeResult.reason === 'legacy') {
            return { success: false, error: 'Badge already awarded', badgeDuplicate: true, awarded: 0, tickets: 0 };
        }
        if (!badgeResult.granted) {
            return { success: false, error: 'Badge condition not met', badgeConditionFailed: true, awarded: 0, tickets: 0 };
        }
        return {
            success: true,
            awarded: badgeResult.xp || 0,
            tickets: 0,
            capped: badgeResult.capped === true,
            favor: !!badgeResult.favor,
            badgeId: badgeResult.badgeId || badgeId,
        };
    }

    const absMax = badgeKnown ? 100000 : 2200;
    if (pts < 0 || pts > absMax) {
        return { success: false, error: 'Invalid points amount', awarded: 0, tickets: 0 };
    }
    if (pts === 0) {
        return { success: false, error: 'Nothing to award', awarded: 0, tickets: 0 };
    }

    const reason = action;
    const DAILY_CAP = awardActions.DAILY_CAP;
    const offsetToday = getOffsetDateKey(); // 5 AM UTC — single source of truth for all daily gates
    if (matchedAction === 'trivia_correct' || matchedAction === 'trivia_attempt') {
        const triviaGrade = require('./src/triviaBank').grade(offsetToday, data && data.triviaChoice);
        if (matchedAction === 'trivia_correct' && !triviaGrade.correct) {
            matchedAction = 'trivia_attempt';
            pts = 10;
        }
    }
    const userRef = db.collection('users').doc(uid);
    const dailyPtsRef = userRef.collection('daily_points').doc(offsetToday);
    const rewardGroup = rewardNotify.groupForAction(matchedAction);
    const rewardGroupRef = rewardGroup
        ? db.collection('notifications').doc(rewardNotify.groupDocId(uid, rewardGroup, offsetToday))
        : null;

    const cooldownRef = (resolved.cooldownMs > 0)
        ? db.collection('action_cooldowns').doc(uid + '_' + matchedAction)
        : null;
    const countRef = userRef.collection('daily_action_counts').doc(awardActions.countDocId(resolved, offsetToday));
    const badgeAwardRef = badgeKnown ? userRef.collection('badge_awards').doc(badgeId) : null;
    const trifectaAction = matchedAction === 'quiz_correct' || matchedAction === 'trivia_correct' || matchedAction === 'trivia_attempt' || matchedAction === 'poll_vote';
    const tctvTicketRef = matchedAction === 'tctv_watch_10m'
        ? userRef.collection('award_claims').doc(ticketGrants.claimId('tctv_watch_ticket', offsetToday))
        : null;
    const trifectaTicketRef = trifectaAction
        ? userRef.collection('award_claims').doc(ticketGrants.claimId('daily_trifecta_ticket', offsetToday))
        : null;
    const quizProofRef = trifectaAction
        ? userRef.collection('daily_action_counts').doc(offsetToday + '_quiz_correct')
        : null;
    const triviaProofRef = trifectaAction
        ? userRef.collection('award_claims').doc(offsetToday + '_trivia_trivia')
        : null;
    const pollProofRef = trifectaAction
        ? userRef.collection('award_claims').doc(offsetToday + '_poll_vote_poll')
        : null;
    const flexProofRef = matchedAction === 'flex_day_complete'
        ? userRef.collection('daily_action_counts').doc(offsetToday + '_flex')
        : null;

    let transactionResult = null;
    try {
        transactionResult = await db.runTransaction(async (t) => {
            const [
                cooldownDoc, badgeAwardDoc, countDoc, userDoc, dailyDoc, rewardGroupDoc,
                tctvTicketDoc, trifectaTicketDoc, quizProofDoc, triviaProofDoc, pollProofDoc,
                flexProofDoc, ledgerDoc
            ] = await Promise.all([
                cooldownRef ? t.get(cooldownRef) : Promise.resolve(null),
                badgeAwardRef ? t.get(badgeAwardRef) : Promise.resolve(null),
                t.get(countRef),
                t.get(userRef),
                t.get(dailyPtsRef),
                rewardGroupRef ? t.get(rewardGroupRef) : Promise.resolve(null),
                tctvTicketRef ? t.get(tctvTicketRef) : Promise.resolve(null),
                trifectaTicketRef ? t.get(trifectaTicketRef) : Promise.resolve(null),
                quizProofRef ? t.get(quizProofRef) : Promise.resolve(null),
                triviaProofRef ? t.get(triviaProofRef) : Promise.resolve(null),
                pollProofRef ? t.get(pollProofRef) : Promise.resolve(null),
                flexProofRef ? t.get(flexProofRef) : Promise.resolve(null),
                t.get(db.collection('faucet_ledger').doc(uid)),
            ]);

            if (cooldownDoc && cooldownDoc.exists) {
                const lastAction = cooldownDoc.data().ts;
                const lastTime = lastAction ? (lastAction.toDate ? lastAction.toDate() : new Date(lastAction)) : null;
                if (lastTime && (Date.now() - lastTime.getTime()) < resolved.cooldownMs) {
                    throw new Error('TOO_FAST');
                }
            }
            if (badgeAwardDoc && badgeAwardDoc.exists) {
                throw new Error('BADGE_ALREADY_AWARDED:' + badgeId);
            }

            const usedCount = countDoc && countDoc.exists ? (countDoc.data().count || 0) : 0;
            if (usedCount >= resolved.dailyLimit) {
                throw new Error('DAILY_ACTION_LIMIT:' + matchedAction + ':' + resolved.dailyLimit);
            }

            if (!userDoc.exists) throw new Error('User not found');
            const userData = userDoc.data();
            const ledger = ledgerDoc && ledgerDoc.exists ? (ledgerDoc.data() || {}) : {};
            if (userData.ban_reason || userData.banned === true || userData.satsDisabled === true || ledger.banned === true) {
                throw new Error('BANNED');
            }
            if (resolved.requiresDoubleXp && !doubleXp.isActive(userData, Date.now())) {
                throw new Error('DOUBLE_XP_REQUIRED');
            }
            // Double XP covers daily-capped activity only. Badges, the scholar
            // exam, and onboarding are not multiplied. A client amount that is
            // already the doubled allowlist value is not multiplied again.
            const actionLower = String(reason || '').toLowerCase();
            const skipDouble = matchedAction === 'badge_earned'
                || matchedAction === 'scholar_cert'
                || actionLower.indexOf('nacho quest') !== -1
                || actionLower.indexOf('onboarding') !== -1
                || resolved.requiresDoubleXp;
            const xpBoost = skipDouble
                ? { points: pts, doubled: !!resolved.requiresDoubleXp, until: doubleXp.untilMillis(userData) }
                : doubleXp.boostPoints(pts, userData, Date.now());
            pts = xpBoost.points;

            if (matchedAction === 'badge_earned' && badgeKnown) {
                const MILESTONE_BADGE_THRESHOLDS = {
                    'hall_of_fame':       50,
                    'the_archive':       100,
                    'genesis_block':     150,
                    'satoshis_ghost':    200,
                    'block_250':         250,
                    'the_hodler':        300,
                    'satoshis_covenant': 350,
                    'satoshis_cipher':   400,
                };
                if (MILESTONE_BADGE_THRESHOLDS[badgeId] !== undefined) {
                    const required = MILESTONE_BADGE_THRESHOLDS[badgeId];
                    const owned = Array.isArray(userData.visibleBadges) ? userData.visibleBadges.length : 0;
                    if (owned < required) {
                        console.warn(`[awardPoints] milestone badge rejected: ${badgeId} needs ${required} badges, user has ${owned} uid=${uid}`);
                        throw new Error('BADGE_CONDITION_NOT_MET:' + badgeId);
                    }
                }
                if (badgeId === 'streak_365') {
                    if ((userData.bestStreak || 0) < 365) {
                        console.warn(`[awardPoints] streak_365 rejected: bestStreak=${userData.bestStreak} uid=${uid}`);
                        throw new Error('BADGE_CONDITION_NOT_MET:streak_365');
                    }
                }
                if (badgeId === 'sats_21k') {
                    if ((userData.satsWithdrawn || 0) < 21000) {
                        console.warn(`[awardPoints] sats_21k rejected: satsWithdrawn=${userData.satsWithdrawn} uid=${uid}`);
                        throw new Error('BADGE_CONDITION_NOT_MET:sats_21k');
                    }
                }
                const flexAllMet = awardActions.flexAllBadgeMet(badgeId, userData.flexFullDays || 0);
                if (flexAllMet === false) {
                    console.warn(`[awardPoints] flex day badge rejected: ${badgeId} flexFullDays=${userData.flexFullDays || 0} uid=${uid}`);
                    throw new Error('BADGE_CONDITION_NOT_MET:' + badgeId);
                }
            }
            if (matchedAction === 'flex_day_complete') {
                const flexHave = flexProofDoc && flexProofDoc.exists ? (flexProofDoc.data().count || 0) : 0;
                if (!awardActions.flexDayStatus(flexHave).complete) {
                    throw new Error('FLEX_DAY_NOT_MET');
                }
            }

            const nextCount = usedCount + 1;
            const claimRef = badgeKnown
                ? null
                : userRef.collection('award_claims').doc(awardActions.claimId(resolved, offsetToday, nextCount));
            const claimDoc = claimRef ? await t.get(claimRef) : null;
            if (claimDoc && claimDoc.exists) throw new Error('ALREADY_CLAIMED');

            const dailyUsed = dailyDoc && dailyDoc.exists ? (dailyDoc.data().total || 0) : 0;
            const grant = awardActions.planGrant({
                xp: pts,
                dailyUsed: dailyUsed,
                dailyCap: DAILY_CAP,
            });
            const awarded = grant.awarded;
            const capped = grant.capped;
            const dropped = grant.dropped;

            const userUpdate = {};
            let flexMeta = null;
            if (matchedAction === 'flex_action' && awarded > 0) {
                flexMeta = awardActions.nextFlexFullDays(userData, offsetToday, nextCount);
                if (flexMeta.incremented) {
                    userUpdate.flexFullDays = admin.firestore.FieldValue.increment(1);
                    userUpdate.flexFullDay = offsetToday;
                }
            }
            let channelTracked = false;
            if (channelId && VALID_CHANNEL_IDS.has(channelId)) {
                userUpdate.visitedChannelsList = admin.firestore.FieldValue.arrayUnion(channelId);
                const currentList = Array.isArray(userData.visitedChannelsList) ? userData.visitedChannelsList : [];
                if (currentList.indexOf(channelId) === -1) {
                    userUpdate.channelsVisited = admin.firestore.FieldValue.increment(1);
                }
                channelTracked = true;
            } else if (channelId) {
                console.warn('[awardPoints] channelId rejected — not in catalog:', channelId, 'uid:', uid);
            }

            const totalPointsOut = awarded;
            if (totalPointsOut > 0) {
                userUpdate.points = admin.firestore.FieldValue.increment(totalPointsOut);
                userUpdate.weeklyXP = admin.firestore.FieldValue.increment(awarded);
                userUpdate.monthlyXP = admin.firestore.FieldValue.increment(awarded);
                userUpdate.activeDayKeys = referralDecisions.touchActiveDays(userData.activeDayKeys, Date.now());
            }

            const rankPrevById = await rewardNotify.readRankPrev(t, db, uid, userData.points || 0, totalPointsOut);

            const bonus = ticketGrants.bonusTickets(matchedAction, awarded, {
                tctvClaimed: !!(tctvTicketDoc && tctvTicketDoc.exists),
                trifectaClaimed: !!(trifectaTicketDoc && trifectaTicketDoc.exists),
                quiz: !!(quizProofDoc && quizProofDoc.exists && (quizProofDoc.data().count || 0) > 0),
                trivia: !!(triviaProofDoc && triviaProofDoc.exists),
                poll: !!(pollProofDoc && pollProofDoc.exists),
            });
            if (bonus.tickets > 0) {
                userUpdate.orangeTickets = admin.firestore.FieldValue.increment(bonus.tickets);
                bonus.kinds.forEach(function(kind) {
                    t.set(userRef.collection('award_claims').doc(ticketGrants.claimId(kind, offsetToday)), {
                        action: kind,
                        tickets: ticketGrants.get(kind).tickets,
                        day: offsetToday,
                        at: admin.firestore.FieldValue.serverTimestamp(),
                    });
                });
            }

            // Save the badge even when the daily cap drops the XP.
            if (badgeAwardRef) {
                t.set(badgeAwardRef, { awardedAt: admin.firestore.FieldValue.serverTimestamp(), action: action });
                userUpdate.visibleBadges = admin.firestore.FieldValue.arrayUnion(badgeId);
            }
            const proofAction = matchedAction === 'flex_action' || matchedAction === 'trivia_correct' || matchedAction === 'lq_lesson';
            let progress = null;
            if (claimRef && (awarded > 0 || proofAction)) {
                t.set(claimRef, {
                    action: matchedAction,
                    xp: awarded,
                    day: offsetToday,
                    at: admin.firestore.FieldValue.serverTimestamp(),
                });
                progress = progressBadges.progressSpec(userData, matchedAction, resolved, offsetToday);
                progressBadges.applySpec(userUpdate, admin, progress);
                if (matchedAction === 'flex_action' && resolved.flexId) {
                    t.set(userRef.collection('daily_action_counts').doc(offsetToday + '_flex_' + resolved.flexId), {
                        actionId: resolved.flexId,
                        day: offsetToday,
                    }, { merge: true });
                }
            }
            if (awarded > 0 || badgeAwardRef) {
                t.set(countRef, {
                    count: nextCount,
                    lastAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
            if (Object.keys(userUpdate).length > 0) {
                t.update(userRef, userUpdate);
            }
            if (awarded > 0) {
                t.set(dailyPtsRef, {
                    total: dailyUsed + awarded,
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
            if (cooldownRef && awarded > 0) {
                t.set(cooldownRef, { ts: admin.firestore.FieldValue.serverTimestamp() });
            }

            try {
                const rewardSpec = {
                    uid: uid,
                    action: matchedAction,
                    reason: reason,
                    day: offsetToday,
                    xp: awarded,
                    tickets: bonus.tickets,
                    freezes: 0,
                    badgeId: badgeAwardRef ? badgeId : null,
                    pointsBefore: userData.points || 0,
                    pointsDelta: totalPointsOut,
                    prevById: rankPrevById,
                };
                if (rewardGroup) {
                    rewardSpec.existing = rewardGroupDoc && rewardGroupDoc.exists ? rewardGroupDoc.data() : null;
                }
                rewardNotify.apply(t, db, admin.firestore.FieldValue.serverTimestamp(), rewardNotify.plan(rewardSpec));
            } catch (notifyErr) {
                console.warn('[awardPoints] reward notify skipped:', notifyErr && notifyErr.message);
            }

            return {
                awarded: awarded,
                tickets: bonus.tickets,
                capped: capped,
                dropped: dropped,
                dailyUsed: dailyUsed + awarded,
                overflowAdded: 0,
                overflowRedeemed: 0,
                pendingOverflow: userData.pendingOverflow || 0,
                pastCap: grant.pastCap,
                dailyXp: grant.dailyXp,
                dailyCap: grant.dailyCap,
                fullUntil: grant.fullUntil,
                halfUntil: grant.halfUntil,
                channelTracked: channelTracked,
                progress: progress,
                doubled: xpBoost.doubled,
                doubleXpUntil: xpBoost.until || 0,
                flexCount: flexMeta ? flexMeta.count : null,
                flexDayComplete: flexMeta ? flexMeta.complete : false,
                flexFullDays: flexMeta ? flexMeta.flexFullDays : null,
            };
        });
    } catch (e) {
        if (e.message === 'TOO_FAST') {
            return { success: false, error: 'Too fast - wait a moment', cooldown: true, awarded: 0, tickets: 0 };
        }
        if (e.message === 'BANNED') {
            return { success: true, awarded: 0, tickets: 0, banned: true };
        }
        if (e.message === 'DOUBLE_XP_REQUIRED') {
            return { success: false, error: 'Double XP is not active', awarded: 0, tickets: 0 };
        }
        if (e.message && e.message.startsWith('BADGE_ALREADY_AWARDED:')) {
            return { success: false, error: 'Badge already awarded', badgeDuplicate: true, awarded: 0, tickets: 0 };
        }
        if (e.message && e.message.startsWith('BADGE_CONDITION_NOT_MET:')) {
            return { success: false, error: 'Badge condition not met', badgeConditionFailed: true, awarded: 0, tickets: 0 };
        }
        if (e.message === 'FLEX_DAY_NOT_MET') {
            return { success: false, error: 'Finish 5 Flex actions today first', flexDayNotMet: true, awarded: 0, tickets: 0 };
        }
        if (e.message && e.message.startsWith('DAILY_ACTION_LIMIT:')) {
            const parts = e.message.split(':');
            const limit = parts[2];
            return { success: false, error: 'Daily limit reached for this action (max ' + limit + '/day). Try again tomorrow.', dailyActionCapped: true, awarded: 0, tickets: 0 };
        }
        if (e.message === 'ALREADY_CLAIMED' || (e.message && e.message.startsWith('ALREADY_CLAIMED'))) {
            return { success: false, error: 'Already claimed', awarded: 0, tickets: 0, dailyActionCapped: true };
        }
        console.error('[AWARD_POINTS_TRANS_ERR]', e);
        return { success: false, error: 'Internal error', awarded: 0, tickets: 0 };
    }

    if (transactionResult && transactionResult.channelTracked) {
        try { await grantFamily(db, admin, uid, familyFor('channelsVisited')); }
        catch (channelBadgeErr) { console.warn('[awardPoints] channel badges', channelBadgeErr && channelBadgeErr.message); }
    }
    if (transactionResult && transactionResult.progress) {
        try { await progressBadges.grantProgress(db, admin, uid, transactionResult.progress); }
        catch (progressErr) { console.warn('[awardPoints] progress badges', progressErr && progressErr.message); }
    }
    if (transactionResult && transactionResult.tickets > 0) {
        try { await grantFamily(db, admin, uid, familyFor('orangeTickets')); }
        catch (ticketBadgeErr) { console.warn('[awardPoints] ticket badges', ticketBadgeErr && ticketBadgeErr.message); }
    }
    if (matchedAction === 'trivia_correct' || matchedAction === 'trivia_attempt') {
        try {
            const favorApi = require('./src/satoshiFavor');
            await dailyFive.maybeCompleteTrifecta({
                db: db, admin: admin, uid: uid, day: offsetToday, creditDailyAllThree: favorApi.creditDailyAllThree,
            });
        } catch (followErr) {
            console.warn('[awardPoints] trifecta follow-up skipped', followErr && followErr.message);
        }
    }

    return {
        success: true,
        awarded: transactionResult.awarded,
        tickets: 0,
        capped: transactionResult.capped,
        dropped: transactionResult.dropped,
        dailyUsed: transactionResult.dailyUsed,
        overflowAdded: 0,
        overflowRedeemed: 0,
        pendingOverflow: transactionResult.pendingOverflow,
        pastCap: transactionResult.pastCap === true,
        dailyXp: transactionResult.dailyXp,
        dailyCap: transactionResult.dailyCap,
        fullUntil: transactionResult.fullUntil,
        halfUntil: transactionResult.halfUntil,
        channelTracked: transactionResult.channelTracked,
        doubled: !!transactionResult.doubled,
        doubleXpUntil: transactionResult.doubleXpUntil || 0,
        flexCount: transactionResult.flexCount,
        flexDayComplete: !!transactionResult.flexDayComplete,
        flexFullDays: transactionResult.flexFullDays,
    };
});

// ===== FAUCET ADMIN - getFaucetStats =====
exports.getFaucetStats = functionsV1.https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.token.admin) {
        throw new functionsV1.https.HttpsError('permission-denied', 'Admin only');
    }
    const today = new Date().toISOString().split('T')[0];
    const statsDoc = await db.collection('faucet_stats').doc(today).get();
    const configDoc = await db.collection('faucet_config').doc('settings').get();

    let walletBalance = 0;
    try {
        const nwc = new NWCClient({ nostrWalletConnectUrl: FAUCET.NWC_URL });
        const bal = await nwc.getBalance();
        walletBalance = Math.floor(bal.balance / 1000);
    } catch(e) { walletBalance = -1; }

    const { NWC_URL: _redacted, ...safeLimits } = FAUCET;
    return {
        today: statsDoc.exists ? statsDoc.data() : { totalPaid: 0, claimCount: 0 },
        paused: configDoc.exists ? !!configDoc.data().paused : false,
        walletBalance: walletBalance,
        limits: safeLimits
    };
});

// ===== FAUCET ADMIN - toggleFaucet =====
exports.toggleFaucet = functionsV1.https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.token.admin) {
        throw new functionsV1.https.HttpsError('permission-denied', 'Admin only');
    }
    const paused = !!data.paused;
    await db.collection('faucet_config').doc('settings').set({ paused: paused }, { merge: true });
    return { success: true, paused: paused };
});

// ===== ONE-TIME: Backfill bestStreak for all users =====
exports.backfillBestStreak = functionsV1.https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.token.admin) {
        throw new functionsV1.https.HttpsError('permission-denied', 'Admin only');
    }
    const usersSnap = await db.collection('users').get();
    let updated = 0;
    const batch = db.batch();
    usersSnap.forEach(doc => {
        const d = doc.data();
        const streak = d.streak || 0;
        const existing = d.bestStreak || 0;
        if (streak > 0 && existing < streak) {
            batch.update(doc.ref, { bestStreak: streak });
            updated++;
        } else if (!d.bestStreak && streak === 0) {
            batch.update(doc.ref, { bestStreak: 0 });
            updated++;
        }
    });
    if (updated > 0) await batch.commit();
    return { success: true, updated: updated, total: usersSnap.size };
});

// ---- Resolve Predictions (runs every 6 hours) ----
// Scoring is server-only. Clients may create active_predictions with uid,
// direction, price, time, and resolved:false. The start price is fetched here
// and stored in prediction_server, which clients cannot write. Clients cannot
// write prediction_stats, delete the active doc, or bump the community total.
async function _btcUsd() {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    const data = await res.json();
    return data && data.bitcoin && data.bitcoin.usd ? data.bitcoin.usd : 0;
}

exports.resolvePredictions = onSchedule({ schedule: 'every 6 hours', timeZone: 'UTC', timeoutSeconds: 540 }, async (event) => {
    try {
        const result = await predictionJobs.resolveDue(_btcUsd);
        console.log('[resolvePredictions]', JSON.stringify(result));
    } catch (e) {
        console.error('[resolvePredictions] failed:', e);
    }
});

// On create, always fetch BTC and store it in prediction_server, ignoring any
// client price or void flag. Copy that server price onto predPending so the
// card can show "pending" with one read. Totals stay untouched until resolve.
exports.syncPredictionPending = onDocumentWritten('active_predictions/{uid}', async (event) => {
    const uid = event.params.uid;
    const after = event.data.after;
    if (!after.exists) return null;
    try {
        await predictionJobs.syncPending(uid, after.data() || {}, _btcUsd);
    } catch (e) {
        console.error('[syncPredictionPending]', uid, e.message);
    }
    return null;
});

// Monday 05:00 UTC — same boundary as resetWeeklyXP.
// Each of the top 5 (min 5 resolved, not isSatsBanned) gets 25 orange tickets.
exports.payWeeklyPredictors = onSchedule({ schedule: '0 5 * * 1', timeZone: 'UTC', timeoutSeconds: 540 }, async () => {
    try {
        const result = await predictionJobs.payout('weekly', new Date());
        console.log('[payWeeklyPredictors]', JSON.stringify({ action: result.action, periodId: result.periodId, winners: (result.due || []).length, reset: result.reset }));
    } catch (e) {
        console.error('[payWeeklyPredictors] failed:', e);
    }
    return null;
});

// 1st of the month 00:00 UTC — same boundary as resetMonthlyXP.
// Each of the top 5 (min 15 resolved, not isSatsBanned) gets 50 orange tickets.
exports.payMonthlyPredictors = onSchedule({ schedule: '0 0 1 * *', timeZone: 'UTC', timeoutSeconds: 540 }, async () => {
    try {
        const result = await predictionJobs.payout('monthly', new Date());
        console.log('[payMonthlyPredictors]', JSON.stringify({ action: result.action, periodId: result.periodId, winners: (result.due || []).length, reset: result.reset }));
    } catch (e) {
        console.error('[payMonthlyPredictors] failed:', e);
    }
    return null;
});

// ---- One-time backfill global community stats ----
exports.backfillGlobalStats = functionsV1.https.onCall(async (data, context) => {
    // Admin only
    if (!context.auth || (!context.auth.token.admin)) {
        throw new functionsV1.https.HttpsError('permission-denied', 'Admin only');
    }

    const usersSnap = await db.collection('users').get();
    let totalQuestsCompleted = 0;
    let totalPvpMatches = 0;
    let totalChannelVisits = 0;
    let totalPredictions = 0;
    let totalPredictionsCorrect = 0;
    let totalSpins = 0;

    usersSnap.forEach(doc => {
        const u = doc.data();
        // Quests
        if (u.completedQuests && Array.isArray(u.completedQuests)) {
            totalQuestsCompleted += u.completedQuests.length;
        }
        // PVP (each win or loss = 1 match played by this user)
        const wins = u.pvpWins || 0;
        const losses = u.pvpLosses || 0;
        totalPvpMatches += wins; // count unique matches (winner-side only to avoid double count)
        // Channel visits
        if (u.channelsVisited) totalChannelVisits += u.channelsVisited;
        else if (u.readChannels && Array.isArray(u.readChannels)) totalChannelVisits += u.readChannels.length;
        // Predictions
        if (u.predictions) {
            totalPredictions += u.predictions.total || 0;
            totalPredictionsCorrect += u.predictions.correct || 0;
        }
        // Spins - estimate: if user has lastSpinDate, they've spun at least once
        // Better estimate: users with streak > 0 have been active, avg ~10 spins each
        if (u.lastSpinDate) totalSpins += 1;
    });

    // Channel visits from Firestore are "unique channels per user" not total opens
    // Estimate total opens: avg user reads ~3x per unique channel visited
    const estimatedChannelOpens = totalChannelVisits * 3;

    // Spins estimate: users who have spun at least once probably averaged ~8 spins
    const estimatedSpins = totalSpins * 8;

    // Chat messages
    let chatMessages = 0;
    try {
        const chatSnap = await db.collection('global_chat').count().get();
        chatMessages = chatSnap.data().count || 0;
    } catch(e) {
        // count() may not be available, estimate from limit query
        const chatSample = await db.collection('global_chat').limit(500).get();
        chatMessages = chatSample.size;
        if (chatMessages === 500) chatMessages = 800; // estimate if we hit limit
    }

    const globalStats = {
        channelVisits: estimatedChannelOpens,
        questsCompleted: totalQuestsCompleted,
        pvpMatches: totalPvpMatches,
        spins: estimatedSpins,
        chatMessages: chatMessages,
        backfilledAt: Date.now(),
        userCount: usersSnap.size
    };

    await db.collection('stats').doc('global').set(globalStats, { merge: true });

    // Also seed predictions global if not already there
    if (totalPredictions > 0) {
        await db.collection('stats').doc('predictions').set({
            total: totalPredictions,
            correct: totalPredictionsCorrect,
            backfilledAt: Date.now()
        }, { merge: true });
    }

    return {
        success: true,
        raw: {
            users: usersSnap.size,
            uniqueChannelVisits: totalChannelVisits,
            questsCompleted: totalQuestsCompleted,
            pvpWinsTotal: totalPvpMatches,
            usersWhoSpun: totalSpins,
            predictions: totalPredictions,
            predictionsCorrect: totalPredictionsCorrect,
            chatMessages: chatMessages
        },
        estimated: globalStats
    };
});

// ===== SERVER-SIDE DAILY VISIT TRACKING =====
// Handles streak, totalVisits, bestStreak, orangeTickets, streakFreezes
// All these fields are blocked from client writes in Firestore rules
exports.recordDailyVisit = functionsV1.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    if (context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functionsV1.https.HttpsError('permission-denied', 'Sign in required');
    }
    const uid = context.auth.uid;
    const userRef = db.collection('users').doc(uid);

    try {
        const result = await db.runTransaction(async (t) => {
            const userDoc = await t.get(userRef);
            if (!userDoc.exists) throw new Error('User not found');
            const user = userDoc.data();

            const today = getOffsetDateKey(); // 5 AM UTC reset — matches client getDailyKey()
            const lastVisit = user.lastVisit || '';

            // Already visited today
            if (lastVisit === today) {
                return { alreadyVisited: true, streak: user.streak || 0 };
            }

            // Sanity check: streak cannot exceed account age in days
            // Uses Firebase Auth metadata (immutable) to get true account creation date
            let accountAgeDays = 9999;
            try {
                const userRecord = await admin.auth().getUser(uid);
                const creationDate = new Date(userRecord.metadata.creationTime);
                // +1 because creation day counts as day 1 (a 3-hour-old account is still on day 1)
                accountAgeDays = Math.max(1, Math.floor((Date.now() - creationDate.getTime()) / 86400000) + 1);
            } catch(e) {}

            // Calculate streak
            let newStreak = 1;
            let usedFreeze = false;
            let bonusTickets = 0;
            let oldStreak = user.streak || 0;
            const streakFreezes = user.streakFreezes || 0;

            // Cap existing streak to account age (fixes pre-patch inflated values)
            if (oldStreak > accountAgeDays) {
                oldStreak = accountAgeDays;
            }

            if (lastVisit) {
                const lastDate = new Date(lastVisit);
                const todayDate = new Date(today);
                const diffDays = Math.round((todayDate - lastDate) / 86400000);

                if (diffDays === 1) {
                    // Consecutive day
                    newStreak = oldStreak + 1;
                } else if (diffDays === 2 && streakFreezes > 0) {
                    // Missed one day but have a freeze
                    newStreak = oldStreak + 1;
                    usedFreeze = true;
                } else {
                    // Streak broken
                    newStreak = 1;
                }
            }

            // Bonus tickets for streak milestones
            if (newStreak === 7) bonusTickets = 3;
            else if (newStreak === 30) bonusTickets = 10;
            else if (newStreak === 100) bonusTickets = 25;
            else if (newStreak === 365) bonusTickets = 50;

            // Cap streak to account age
            if (newStreak > accountAgeDays) newStreak = accountAgeDays;

            const currentBest = Math.min(user.bestStreak || 0, accountAgeDays);
            const newBest = Math.max(currentBest, newStreak);

            const updateData = {
                totalVisits: admin.firestore.FieldValue.increment(1),
                lastVisit: today,
                streak: newStreak,
                bestStreak: newBest,
            };
            if (bonusTickets > 0) {
                updateData.orangeTickets = admin.firestore.FieldValue.increment(bonusTickets);
            }
            if (usedFreeze) {
                updateData.streakFreezes = admin.firestore.FieldValue.increment(-1);
                updateData.streakFreezesUsed = admin.firestore.FieldValue.increment(1);
            }

            t.update(userRef, updateData);

            if (bonusTickets > 0 || usedFreeze) {
                try {
                    rewardNotify.apply(t, db, admin.firestore.FieldValue.serverTimestamp(), rewardNotify.plan({
                        uid: uid,
                        onceKey: 'visit_' + today,
                        tickets: bonusTickets,
                        freezes: usedFreeze ? -1 : 0,
                        deduction: usedFreeze && bonusTickets <= 0,
                        sourceLabel: usedFreeze ? 'a streak freeze on your daily visit' : (newStreak + '-day streak'),
                        icon: usedFreeze ? '🧊' : '🔥',
                    }));
                } catch (notifyErr) {
                    console.warn('[VISIT] reward notify skipped:', notifyErr && notifyErr.message);
                }
            }

            return {
                alreadyVisited: false,
                streak: newStreak,
                bestStreak: newBest,
                oldStreak: oldStreak,
                usedFreeze: usedFreeze,
                bonusTickets: bonusTickets,
                totalVisits: (user.totalVisits || 0) + 1
            };
        });

        try {
            const visitIds = familyFor('bestStreak').concat(['ghost_reader']);
            if (result.usedFreeze) visitIds.push('streak_freeze');
            await grantFamily(db, admin, uid, visitIds);
        }
        catch (streakBadgeErr) { console.warn('[VISIT] streak badges', streakBadgeErr && streakBadgeErr.message); }
        return { success: true, ...result };
    } catch (e) {
        console.error('[VISIT] recordDailyVisit failed for ' + uid + ':', e.message);
        return { success: false, error: 'Visit recording failed' };
    }
});

// ---- Poll Vote (server-side with IP + fingerprint rate limiting) ----
exports.pollVote = functionsV1.https.onCall(async (data, context) => {
    const { side, fingerprint, satsCount, bitsCount } = data || {};

    // Support batched votes: satsCount + bitsCount, or single side vote (backward compat)
    let sInc = Math.max(0, Math.min(parseInt(satsCount) || 0, 50));
    let bInc = Math.max(0, Math.min(parseInt(bitsCount) || 0, 50));
    // Backward compat: if no batch counts, use single side
    if (sInc === 0 && bInc === 0) {
        if (side === 'sats') sInc = 1;
        else if (side === 'bits') bInc = 1;
        else return { success: false, error: 'Invalid side' };
    }
    const totalInc = sInc + bInc;
    if (totalInc === 0) return { success: false, error: 'No votes' };

    const ip = (context.rawRequest && context.rawRequest.ip) || 'unknown';
    const fp = (fingerprint || '').toString().substring(0, 32) || 'none';
    const db = admin.firestore();
    const dayKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Rate limit: max 200 votes per IP per day, max 200 per fingerprint per day (atomic)
    const MAX_PER_DAY = 200;
    const ratePath = `poll_rate_limits/${dayKey}`;
    const ipKey = 'ip_' + ip.replace(/[.\/:]/g, '_');
    const fpKey = 'fp_' + fp;
    const pollRef = db.doc('polls/sats_vs_bits');
    const rateRef = db.doc(ratePath);

    await db.runTransaction(async (tx) => {
        const rateDoc = await tx.get(rateRef);
        const rateData = rateDoc.exists ? rateDoc.data() : {};
        const ipCount = (rateData[ipKey] || 0);
        const fpCount = (rateData[fpKey] || 0);

        if (ipCount >= MAX_PER_DAY) throw new functionsV1.https.HttpsError('resource-exhausted', 'Daily IP limit reached');
        if (fpCount >= MAX_PER_DAY) throw new functionsV1.https.HttpsError('resource-exhausted', 'Daily device limit reached');

        // Clamp to remaining daily budget
        const remaining = Math.max(0, MAX_PER_DAY - Math.max(ipCount, fpCount));
        const allowed = Math.min(totalInc, remaining);
        // Proportionally distribute if clamped
        const ratio = allowed / totalInc;
        const aSats = Math.round(sInc * ratio);
        const aBits = allowed - aSats;

        // Atomic: increment poll + rate limits together
        const inc = {};
        if (aSats > 0) inc.sats = admin.firestore.FieldValue.increment(aSats);
        if (aBits > 0) inc.bits = admin.firestore.FieldValue.increment(aBits);
        if (aSats > 0 || aBits > 0) tx.set(pollRef, inc, { merge: true });

        const rateInc = {};
        rateInc[ipKey] = admin.firestore.FieldValue.increment(allowed);
        rateInc[fpKey] = admin.firestore.FieldValue.increment(allowed);
        tx.set(rateRef, rateInc, { merge: true });
    });

    // Read current totals to return
    const pollDoc = await pollRef.get();
    const pollData = pollDoc.exists ? pollDoc.data() : { sats: 0, bits: 0 };

    return { success: true, sats: pollData.sats || 0, bits: pollData.bits || 0 };
});

// ---- PVP Answer Submission (server records the choice; pvpResolveRound grades it) ----
async function pvpRateLimit(uid, bucket, maxCount, windowMs) {
    const ref = db.collection('rate_limits').doc('pvp_' + bucket + '_' + uid);
    await db.runTransaction(async (tx) => {
        const doc = await tx.get(ref);
        const now = Date.now();
        if (doc.exists) {
            const d = doc.data() || {};
            const start = d.windowStartMs || 0;
            if (now - start < windowMs) {
                if ((d.count || 0) >= maxCount) {
                    throw new functionsV1.https.HttpsError('resource-exhausted', 'Too many PvP requests');
                }
                tx.update(ref, { count: (d.count || 0) + 1 });
            } else {
                tx.set(ref, { windowStartMs: now, count: 1 });
            }
        } else {
            tx.set(ref, { windowStartMs: now, count: 1 });
        }
    });
}

exports.pvpSubmitAnswer = functionsV1.runWith({ enforceAppCheck: true }).https.onCall(async (data, context) => {
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    const uid = context.auth.uid;
    await pvpRateLimit(uid, 'answer', 30, 60000);

    const { matchId, questionIndex, answerIndex } = data || {};
    if (!matchId || typeof questionIndex !== 'number' || typeof answerIndex !== 'number') {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Missing matchId, questionIndex, or answerIndex');
    }
    if (!Number.isInteger(questionIndex) || !Number.isInteger(answerIndex)) {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Invalid question or answer index');
    }
    if (questionIndex < 0 || questionIndex > 4 || answerIndex < -1 || answerIndex > 5) {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Invalid question or answer index');
    }

    const matchRef = db.collection('pvp_matches').doc(String(matchId));
    const result = await db.runTransaction(async (tx) => {
        const matchDoc = await tx.get(matchRef);
        const keyDoc = await tx.get(db.collection('pvp_answer_keys').doc(String(matchId)));
        if (!matchDoc.exists) throw new functionsV1.https.HttpsError('not-found', 'Match not found');
        const match = matchDoc.data();
        if (match.status !== 'active') throw new functionsV1.https.HttpsError('failed-precondition', 'Match not active');
        if (match.currentQ !== questionIndex) throw new functionsV1.https.HttpsError('failed-precondition', 'Wrong question index');

        const myKey = pvpFlow.playerKeyForUid(keyDoc.exists ? keyDoc.data().playerUids : null, uid);
        if (!myKey) throw new functionsV1.https.HttpsError('permission-denied', 'Not a player in this match');

        const myAnswers = (match[myKey].answers || []).slice();
        if (myAnswers.length > questionIndex) return { alreadyAnswered: true };
        if (myAnswers.length !== questionIndex) {
            throw new functionsV1.https.HttpsError('failed-precondition', 'Answer the current question first');
        }

        // selected only. correct/won are written by pvpResolveRound from the answer key.
        myAnswers.push({
            selected: answerIndex,
            answeredAt: new Date().toISOString()
        });
        const update = {};
        update[myKey + '.answers'] = myAnswers;
        tx.update(matchRef, update);
        return { success: true, alreadyAnswered: false };
    });
    return result;
});

// Opponent went quiet. The caller must already have answered, and the question
// must have been open for at least 15s (questionStartedAt is a server timestamp).
exports.pvpTimeoutOpponent = functionsV1.runWith({ enforceAppCheck: true }).https.onCall(async (data, context) => {
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    const uid = context.auth.uid;
    await pvpRateLimit(uid, 'timeout', 10, 60000);
    const matchId = data && data.matchId;
    if (!matchId || typeof matchId !== 'string') {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Missing matchId');
    }
    const matchRef = db.collection('pvp_matches').doc(matchId);
    return db.runTransaction(async (tx) => {
        const matchDoc = await tx.get(matchRef);
        const keyDoc = await tx.get(db.collection('pvp_answer_keys').doc(matchId));
        if (!matchDoc.exists) throw new functionsV1.https.HttpsError('not-found', 'Match not found');
        const match = matchDoc.data();
        if (match.status !== 'active') throw new functionsV1.https.HttpsError('failed-precondition', 'Match not active');
        const myKey = pvpFlow.playerKeyForUid(keyDoc.exists ? keyDoc.data().playerUids : null, uid);
        if (!myKey) throw new functionsV1.https.HttpsError('permission-denied', 'Not a player in this match');
        const oppKey = myKey === 'player1' ? 'player2' : 'player1';
        const q = match.currentQ || 0;
        const myAnswers = (match[myKey] && match[myKey].answers) || [];
        const oppAnswers = ((match[oppKey] && match[oppKey].answers) || []).slice();
        if (myAnswers.length <= q) throw new functionsV1.https.HttpsError('failed-precondition', 'Answer first');
        if (oppAnswers.length > q) return { alreadyAnswered: true };
        const started = pvpFlow.lastSeenMs(match.questionStartedAt);
        if (!started || (Date.now() - started) < 15000) {
            throw new functionsV1.https.HttpsError('failed-precondition', 'Too early to time out');
        }
        oppAnswers.push({ selected: -1, answeredAt: new Date().toISOString() });
        const update = {};
        update[oppKey + '.answers'] = oppAnswers;
        tx.update(matchRef, update);
        return { success: true };
    });
});



// ---- Daily Spin (server-side validation + reward) ----
exports.dailySpin = functionsV1.https.onCall(async (data, context) => {
    await secondFactor.requireSecondFactor(secondFactor.stamp(data, context));
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    if (context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functionsV1.https.HttpsError('permission-denied', 'Anonymous users cannot spin');
    }

    const uid = context.auth.uid;
    const today = new Date().toISOString().split('T')[0];
    const userRef = db.collection('users').doc(uid);

    // Spin outcomes with weights (server-determined)
    const outcomes = [
        { label: '🎫 1 Ticket',     pts: 0,  tickets: 1,  freezes: 0, closet: false, rare: false, weight: 25 },
        { label: '🎫 2 Tickets',    pts: 0,  tickets: 2,  freezes: 0, closet: false, rare: false, weight: 22 },
        { label: '⭐ 10 pts',        pts: 10, tickets: 0,  freezes: 0, closet: false, rare: false, weight: 18 },
        { label: '🎫 3 Tickets',    pts: 0,  tickets: 3,  freezes: 0, closet: false, rare: false, weight: 12 },
        { label: '⭐ 25 pts',        pts: 25, tickets: 0,  freezes: 0, closet: false, rare: false, weight: 8 },
        { label: '👔 Closet!',       pts: 0,  tickets: 0,  freezes: 0, closet: true,  rare: false, weight: 5 },
        { label: '🧊 Freeze!',       pts: 0,  tickets: 0,  freezes: 1, closet: false, rare: false, weight: 4 },
        { label: '⭐ 50 pts',        pts: 50, tickets: 0,  freezes: 0, closet: false, rare: false, weight: 3 },
        { label: '🎫 5 Tickets',    pts: 0,  tickets: 5,  freezes: 0, closet: false, rare: false, weight: 1.5 },
        { label: '💎 RARE!',         pts: 0,  tickets: 0,  freezes: 0, closet: false, rare: true,  weight: 1.5 },
    ];

    // Rare drop sub-table
    const rareOutcomes = [
        { label: '🎫 10 Tickets',       tickets: 10,   weight: 1000 },
        { label: '🎫 25 Tickets',       tickets: 25,   weight: 500 },
        { label: '🎫 50 Tickets',       tickets: 50,   weight: 100 },
        { label: '🎫 100 Tickets!',     tickets: 100,  weight: 50 },
        { label: '🎫 500 Tickets!!',    tickets: 500,  weight: 10 },
        { label: '🎫💎 1,000 Tickets!!!', tickets: 1000, weight: 3 },
    ];

    function weightedRandom(table) {
        const totalWeight = table.reduce((s, o) => s + o.weight, 0);
        let roll = Math.random() * totalWeight;
        for (const item of table) {
            roll -= item.weight;
            if (roll <= 0) return item;
        }
        return table[0];
    }

    const result = await db.runTransaction(async (tx) => {
        const spinDay = getOffsetDateKey();
        const dailyRef = userRef.collection('daily_points').doc(spinDay);
        const ledgerRef = db.collection('faucet_ledger').doc(uid);
        const userDoc = await tx.get(userRef);
        const dailyDoc = await tx.get(dailyRef);
        const ledgerDoc = await tx.get(ledgerRef);
        if (!userDoc.exists) throw new functionsV1.https.HttpsError('not-found', 'User not found');

        const userData = userDoc.data();
        // Allow if server granted a bonus spin (flag set atomically by useBonusSpin CF)
        const isBonusSpin = !!userData.bonusSpinGranted;
        if (userData.lastSpinDate === today && !isBonusSpin) {
            throw new functionsV1.https.HttpsError('already-exists', 'Already spun today');
        }

        // Server determines reward
        let reward = weightedRandom(outcomes);
        let rewardIndex = outcomes.indexOf(reward);
        let totalPts = reward.pts;
        let totalTickets = reward.tickets;
        let totalFreezes = reward.freezes;
        let rareLabel = null;

        // Handle rare drop
        if (reward.rare) {
            const rareDrop = weightedRandom(rareOutcomes);
            totalTickets = rareDrop.tickets;
            rareLabel = rareDrop.label;
        }

        // Handle closet (award 25 pts as bonus if all items owned - client handles item logic)
        if (reward.closet) {
            totalPts = 25; // Closet item selection handled client-side from server response
        }
        // Double XP does not apply. The wheel still shares the 500 / 900 / 1,000 cap.
        const spinDoubled = false;
        const spinLedger = ledgerDoc.exists ? (ledgerDoc.data() || {}) : {};
        const spinBlocked = !!(userData.ban_reason) || userData.banned === true || userData.satsDisabled === true || spinLedger.banned === true;
        const spinUsed = dailyDoc.exists ? (Number((dailyDoc.data() || {}).total) || 0) : 0;
        if (spinBlocked) totalPts = 0;
        else if (totalPts > 0) {
            totalPts = require('./src/dailyXp').planDailyXp(spinUsed, totalPts).awarded;
        }

        // Atomic update
        const update = {};
        // Only stamp lastSpinDate for the regular daily spin — bonus spins must NOT
        // consume the user's daily spin slot.
        if (!isBonusSpin) {
            update.lastSpinDate = today;
            update.spinDays = admin.firestore.FieldValue.increment(1);
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            update.spinStreak = userData.lastSpinDate === yesterday
                ? admin.firestore.FieldValue.increment(1)
                : 1;
        }
        // Clear the one-time bonus spin flag if it was set
        if (isBonusSpin) update.bonusSpinGranted = admin.firestore.FieldValue.delete();
        if (totalPts > 0) update.points = admin.firestore.FieldValue.increment(totalPts);
        if (totalTickets > 0) update.orangeTickets = admin.firestore.FieldValue.increment(totalTickets);
        if (totalFreezes > 0) update.streakFreezes = admin.firestore.FieldValue.increment(totalFreezes);
        if (reward.rare) update.spinHitRare = true;
        if (reward.closet) update.spinClosetAwards = admin.firestore.FieldValue.increment(1);
        const spinRankPrev = await rewardNotify.readRankPrev(tx, db, uid, userData.points || 0, totalPts);
        tx.update(userRef, update);
        if (totalPts > 0) {
            tx.set(dailyRef, {
                total: spinUsed + totalPts,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        try {
            const spinGains = reward.closet ? ['👔 a closet drop'] : [];
            rewardNotify.apply(tx, db, admin.firestore.FieldValue.serverTimestamp(), rewardNotify.plan({
                uid: uid,
                onceKey: isBonusSpin ? ('spin_bonus_' + Date.now()) : ('spin_' + today),
                xp: totalPts,
                tickets: totalTickets,
                freezes: totalFreezes,
                gains: spinGains,
                sourceLabel: isBonusSpin ? 'a bonus spin' : 'the daily spin',
                icon: '🎡',
                pointsBefore: userData.points || 0,
                pointsDelta: totalPts,
                prevById: spinRankPrev,
            }));
        } catch (notifyErr) {
            console.warn('[SPIN] reward notify skipped:', notifyErr && notifyErr.message);
        }

        // Increment global spin counter
        const statsRef = db.collection('stats').doc('global');
        tx.set(statsRef, { spins: admin.firestore.FieldValue.increment(1) }, { merge: true });

        return {
            rewardIndex,
            label: reward.label,
            pts: totalPts,
            tickets: totalTickets,
            freezes: totalFreezes,
            closet: reward.closet,
            rare: reward.rare,
            rareLabel,
            doubled: spinDoubled,
            doubleXpUntil: doubleXp.untilMillis(userData) || 0,
            countedDay: !isBonusSpin,
        };
    });

    try {
        const spinIds = result.countedDay ? familyFor('spinDays').concat(familyFor('spinStreak')) : [];
        if (result.rare) spinIds.push.apply(spinIds, familyFor('spinHitRare'));
        if (result.closet) spinIds.push.apply(spinIds, familyFor('spinClosetAwards'));
        if (result.tickets > 0) spinIds.push.apply(spinIds, familyFor('orangeTickets'));
        await grantFamily(db, admin, uid, spinIds);
        if (result.countedDay) {
            await require('./src/comboActivity').noteComboZone(db, admin, uid, 'spin', getOffsetDateKey());
        }
    } catch (spinBadgeErr) { console.warn('[SPIN] badges', spinBadgeErr && spinBadgeErr.message); }

    return { success: true, reward: result };
});

// ---- Update PVP Stats (server-side) ----
// updatePvpStats and incrementUserStat REMOVED - exploitable without verification.
// PVP stats and points are settled once in settlePvpMatch when a match ends.
// Forum/market stats are display-only (not gated or redeemable).

// ── PVP Store Answer Key ──
// pvpCreateMatch writes the key. Clients cannot overwrite a slot (that was a
// mid-match cheat: change the correct index after seeing the question).
exports.pvpStoreAnswerKey = functionsV1.runWith({ enforceAppCheck: true }).https.onCall(async (data, context) => {
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    const { matchId, keys, keyIndex } = data || {};
    if (typeof keyIndex === 'number') {
        throw new functionsV1.https.HttpsError('permission-denied', 'Answer keys are server-owned');
    }
    await pvpRateLimit(context.auth.uid, 'key', 6, 60000);
    // keys: array of correct-answer integers
    // keyIndex: when set, this is a reroll — update one specific slot rather than the full array
    if (!matchId || !Array.isArray(keys) || keys.length < 1 || keys.length > 10) {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Invalid matchId or keys');
    }
    // Validate keys are all valid integers (0-3)
    for (const k of keys) {
        if (typeof k !== 'number' || k < 0 || k > 3 || !Number.isInteger(k)) {
            throw new functionsV1.https.HttpsError('invalid-argument', 'Invalid key value');
        }
    }
    const uid = context.auth.uid;
    const keyRef = db.collection('pvp_answer_keys').doc(matchId);
    const existing = await keyRef.get();
    // Keys and player uids are written by pvpCreateMatch. Clients cannot plant either.
    if (!existing.exists) {
        throw new functionsV1.https.HttpsError('permission-denied', 'Answer keys are server-owned');
    }
    const mine = pvpFlow.playerKeyForUid(existing.data().playerUids, uid);
    if (!mine) throw new functionsV1.https.HttpsError('permission-denied', 'Not a player in this match');
    return { success: true, alreadySet: true };
});

function pvpSafePic(url) {
    return pvpFlow.pvpPicAllowed(url);
}

// ── PVP Match Creation (server-side, hides answer keys) ──
exports.pvpCreateMatch = functionsV1.runWith({ enforceAppCheck: true }).https.onCall(async (data, context) => {
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    await pvpRateLimit(context.auth.uid, 'create', 10, 60000);

    // [SECURITY FIX] Caller is always player2 (the matchmaker who found an opponent).
    // Pin player2.uid to context.auth.uid — never trust client-supplied uid.
    // player1 identity is pulled from the lobby doc (server-authoritative), not from
    // client-supplied player1 object, preventing player impersonation + rigged matches.
    const callerUid = context.auth.uid;

    const { lobbyDocId, player2, questions } = data || {};
    if (!lobbyDocId || !player2 || !questions || !Array.isArray(questions)) {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Missing required fields');
    }
    if (questions.length < 1 || questions.length > 5) {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Invalid question count');
    }
    if (typeof lobbyDocId !== 'string' || lobbyDocId.length < 4 || lobbyDocId.length > 128) {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Invalid lobby');
    }

    // Shuffle option order so the caller cannot keep the index they submitted.
    // The key stays in pvp_answer_keys. The match doc never contains `correct`.
    const shuffled = questions.map((q) => {
        if (!q || typeof q.q !== 'string' || q.q.length < 1 || q.q.length > 300) {
            throw new functionsV1.https.HttpsError('invalid-argument', 'Bad question');
        }
        if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) {
            throw new functionsV1.https.HttpsError('invalid-argument', 'Bad options');
        }
        if (typeof q.correct !== 'number' || !Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.options.length) {
            throw new functionsV1.https.HttpsError('invalid-argument', 'Bad answer key');
        }
        for (const opt of q.options) {
            if (typeof opt !== 'string' || opt.length < 1 || opt.length > 200) {
                throw new functionsV1.https.HttpsError('invalid-argument', 'Bad option');
            }
        }
        return pvpFlow.shuffleQuestion(q);
    });
    const answerKeys = shuffled.map((q, i) => ({ questionIndex: i, correct: q.correct }));
    const clientQuestions = shuffled.map(q => ({ q: q.q, options: q.options }));

    // Use a transaction to atomically claim the lobby doc and create the match.
    // This prevents the race condition where both players try to create a match
    // against each other simultaneously.
    const lobbyRef = db.collection('pvp_lobby').doc(lobbyDocId);
    const matchRef = db.collection('pvp_matches').doc(); // pre-generate ID
    let challengedUid = '';
    let challengerName = 'A Bitcoiner';

    await db.runTransaction(async (tx) => {
        const lobbySnap = await tx.get(lobbyRef);
        if (!lobbySnap.exists) {
            throw new functionsV1.https.HttpsError('not-found', 'Lobby entry not found');
        }
        const lobbyData = lobbySnap.data();
        if (lobbyData.status !== 'waiting') {
            throw new functionsV1.https.HttpsError('already-exists', 'Opponent already matched');
        }

        // [SECURITY FIX] Pull player1 identity from the lobby doc (server-authoritative).
        // The lobby doc was written by player1 with their own uid (rules enforce uid==docId),
        // so this is tamper-proof. Client-supplied player1 object is ignored entirely.
        const p1Uid = lobbyData.uid;
        if (!p1Uid) {
            throw new functionsV1.https.HttpsError('internal', 'Lobby doc missing uid');
        }
        // Caller (player2) must not be the same person as player1
        if (p1Uid === callerUid) {
            throw new functionsV1.https.HttpsError('permission-denied', 'Cannot match against yourself');
        }
        const p1User = await tx.get(db.collection('users').doc(p1Uid));
        const p2User = await tx.get(db.collection('users').doc(callerUid));
        const p1Name = pvpFlow.safeDisplayName(p1User.exists ? p1User.data().username : lobbyData.name);
        const p2Name = pvpFlow.safeDisplayName(p2User.exists ? p2User.data().username : (player2 && player2.name));
        const p2Pic = pvpSafePic(player2 && player2.profilePic);
        challengedUid = p1Uid;
        challengerName = p2Name;

        // Create the match document
        tx.set(matchRef, {
            player1: {
                uid: p1Uid,
                name: p1Name,
                profilePic: pvpSafePic(lobbyData.profilePic),
                score: 0, correct: 0, answers: []
            },
            player2: {
                // uid pinned to verified caller — never from client payload
                uid: callerUid,
                name: p2Name,
                profilePic: p2Pic,
                score: 0, correct: 0, answers: []
            },
            questions: clientQuestions,
            currentQ: 0,
            status: 'countdown',
            questionWinner: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            questionStartedAt: null
        });

        // Store answer keys in server-only collection
        tx.set(db.collection('pvp_answer_keys').doc(matchRef.id), {
            keys: answerKeys,
            playerUids: { player1: p1Uid, player2: callerUid },
            player1Name: p1Name,
            player2Name: p2Name,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Atomically mark lobby as matched
        tx.update(lobbyRef, {
            status: 'matched',
            matchId: matchRef.id,
            opponentName: p2Name,
            opponentUid: callerUid,
            opponentProfilePic: p2Pic
        });
    });

    if (challengedUid) {
        try {
            await sendUserPush(challengedUid, 'pvp', {
                title: 'PvP challenge',
                body: challengerName + ' is ready in the lobby.',
                url: 'https://bitcoineducation.quest/#pvp'
            });
        } catch (e) { console.warn('[pvpCreateMatch] push failed', e.message); }
    }

    return { matchId: matchRef.id };
});

// ── Scholar Exam: Server-Side Grading ──
// SCHOLAR_BANK is loaded once per cold start. Contains authoritative correct answers.
// Format: { properties: [{a: "..."}, ...], technical: [{a: "..."}, ...] }
const SCHOLAR_BANK = require('./scholar-bank.json');

function _pickScholarQuestions(type) {
    const pool = type === 'technical' ? SCHOLAR_BANK.technical : SCHOLAR_BANK.properties;
    if (!Array.isArray(pool) || pool.length < 25) {
        throw new functionsV1.https.HttpsError('internal', 'Exam bank misconfigured');
    }
    // Pick 25 unique indices
    const indices = [];
    const used = new Set();
    while (indices.length < 25) {
        const i = Math.floor(Math.random() * pool.length);
        if (!used.has(i)) { used.add(i); indices.push(i); }
    }
    return indices; // array of 25 ints into SCHOLAR_BANK[type]
}

exports.startScholarExam = functionsV1.https.onCall(async (data, context) => {
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    if (context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functionsV1.https.HttpsError('permission-denied', 'Anonymous users cannot take exams');
    }

    const { type } = data || {};
    if (type !== 'properties' && type !== 'technical') {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Invalid exam type');
    }

    const uid = context.auth.uid;
    const examId = uid + '_' + type + '_' + Date.now();

    // SERVER picks the questions (by index into its own bank). The client
    // never gets to supply answer keys - this closes C-NEW-7.
    const indices = _pickScholarQuestions(type);
    // Build the authoritative key array: the correct answer for each picked question
    const keys = indices.map((idx, i) => ({
        index: i,
        poolIdx: idx,
        correct: SCHOLAR_BANK[type][idx].a
    }));

    await db.collection('scholar_exam_keys').doc(examId).set({
        uid,
        type,
        indices, // indices into the pool - client fetches these
        keys,    // correct answers - never sent to client
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        graded: false,
    });

    // Return ONLY the indices to the client. The client already has the
    // client-side pool and can render questions by index.
    return { examId, indices };
});

exports.gradeScholarExam = functionsV1.https.onCall(async (data, context) => {
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');

    const { examId, answers } = data || {};
    if (!examId || !answers || !Array.isArray(answers)) {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Missing examId or answers');
    }
    if (answers.length !== 25) {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Must have exactly 25 answers');
    }

    const uid = context.auth.uid;
    const examRef = db.collection('scholar_exam_keys').doc(examId);

    const result = await db.runTransaction(async (tx) => {
        const examDoc = await tx.get(examRef);
        if (!examDoc.exists) throw new functionsV1.https.HttpsError('not-found', 'Exam not found');

        const exam = examDoc.data();
        if (exam.uid !== uid) throw new functionsV1.https.HttpsError('permission-denied', 'Not your exam');
        if (exam.graded) throw new functionsV1.https.HttpsError('already-exists', 'Exam already graded');

        const type = exam.type;
        const keyPrefix = type === 'technical' ? 'tech' : 'prop';
        const today = new Date().toISOString().split('T')[0];

        // Read user doc for the daily cooldown. The pass guard is a
        // scholar_exam_keys row. The client cannot write or delete those.
        // gradeScholarExam is the only writer of certPassed_*, certPassedAt_*,
        // and lastExamAttempt_*.
        const userRef = db.collection('users').doc(uid);
        const scholarDay = getOffsetDateKey();
        const dailyRef = userRef.collection('daily_points').doc(scholarDay);
        const ledgerRef = db.collection('faucet_ledger').doc(uid);
        const userDoc = await tx.get(userRef);
        const dailyDoc = await tx.get(dailyRef);
        const ledgerDoc = await tx.get(ledgerRef);
        const userData = userDoc.exists ? userDoc.data() : {};
        const priorPassedSnap = await tx.get(db.collection('scholar_exam_keys').where('uid', '==', uid));
        const alreadyPassed = !!require('./src/scholarExam').passedExam(priorPassedSnap, type, examId);
        const lastAttempt = userData['lastExamAttempt_' + keyPrefix];

        // A passed exam record means no more XP for this cert type, even if
        // the profile flags were cleared.
        if (alreadyPassed) {
            tx.update(examRef, {
                graded: true,
                score: 0,
                passed: false,
                blocked: 'already_certified',
                gradedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            if (userDoc.exists) {
                const repair = {};
                repair['lastExamAttempt_' + keyPrefix] = today;
                repair['certPassed_' + keyPrefix] = true;
                if (!userData['certPassedAt_' + keyPrefix]) {
                    repair['certPassedAt_' + keyPrefix] = admin.firestore.FieldValue.serverTimestamp();
                }
                tx.update(userRef, repair);
            }
            return { score: 0, passed: false, type: type, pointsAwarded: 0, blocked: 'already_certified' };
        }
        // Block rapid retakes same day (daily cooldown)
        if (lastAttempt === today) {
            tx.update(examRef, { graded: true, score: 0, passed: false, blocked: 'daily_limit', gradedAt: admin.firestore.FieldValue.serverTimestamp() });
            throw new functionsV1.https.HttpsError('resource-exhausted', 'Only one exam attempt per 24 hours.');
        }

        // Grade server-side using server-held keys
        let score = 0;
        const keys = exam.keys;
        for (let i = 0; i < 25; i++) {
            if (answers[i] === keys[i].correct) score++;
        }

        const passed = score >= 20;
        const scholarLedger = ledgerDoc.exists ? (ledgerDoc.data() || {}) : {};
        const scholarBlocked = !!(userData.ban_reason) || userData.banned === true || userData.satsDisabled === true || scholarLedger.banned === true;
        const scholarUsed = dailyDoc.exists ? (Number((dailyDoc.data() || {}).total) || 0) : 0;
        const scholarPlan = (passed && !scholarBlocked)
            ? require('./src/dailyXp').planDailyXp(scholarUsed, 2100)
            : { awarded: 0 };
        const scholarRankPrev = scholarPlan.awarded > 0
            ? await rewardNotify.readRankPrev(tx, db, uid, userData.points || 0, scholarPlan.awarded)
            : {};

        // Mark exam as graded
        tx.update(examRef, { graded: true, score, passed, gradedAt: admin.firestore.FieldValue.serverTimestamp() });

        // Save attempt date (rate-limits to one attempt per UTC day)
        const attemptField = 'lastExamAttempt_' + keyPrefix;
        const update = {};
        update[attemptField] = today;

        let pointsAwarded = 0;
        if (passed) {
            // Once per cert type. The 2,100 XP still shares the daily 500 / 900 / 1,000 taper.
            pointsAwarded = scholarPlan.awarded;
            if (pointsAwarded > 0) {
                update.points = admin.firestore.FieldValue.increment(pointsAwarded);
                update.scholarPoints = admin.firestore.FieldValue.increment(pointsAwarded);
            }
            update['certPassed_' + keyPrefix] = true;
            update['certPassedAt_' + keyPrefix] = admin.firestore.FieldValue.serverTimestamp();
        }

        tx.update(userRef, update);
        if (pointsAwarded > 0) {
            tx.set(dailyRef, {
                total: scholarUsed + pointsAwarded,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        if (passed && pointsAwarded > 0) {
            try {
                rewardNotify.apply(tx, db, admin.firestore.FieldValue.serverTimestamp(), rewardNotify.plan({
                    uid: uid,
                    onceKey: 'scholar_' + keyPrefix,
                    xp: pointsAwarded,
                    sourceLabel: type === 'technical' ? 'the protocol exam' : 'the scholar exam',
                    icon: '🎓',
                    pointsBefore: userData.points || 0,
                    pointsDelta: pointsAwarded,
                    prevById: scholarRankPrev,
                }));
            } catch (notifyErr) {
                console.warn('[SCHOLAR] reward notify skipped:', notifyErr && notifyErr.message);
            }
        }

        return { score, passed, type, pointsAwarded };
    });

    if (result.passed && result.type !== 'technical') {
        try { await grantFamily(db, admin, uid, ['scholar']); }
        catch (scholarBadgeErr) { console.warn('[SCHOLAR] badge', scholarBadgeErr && scholarBadgeErr.message); }
    }
    return {
        success: true,
        score: result.score,
        passed: result.passed,
        type: result.type,
        pointsAwarded: result.pointsAwarded || 0,
        blocked: result.blocked || null
    };
});

// ── Quest and trivia rewards. Graded from the bundled bank in questReward.js.
// Client answer keys are ignored. See src/questCallables.js.
const { answerTrivia, gradeQuest, startQuest, triviaXpStatus } = require('./src/questCallables');
exports.answerTrivia = answerTrivia;
exports.gradeQuest = gradeQuest;
exports.startQuest = startQuest;
exports.triviaXpStatus = triviaXpStatus;


// =============================================
// AUDIT FIX: Secure Certificate Issuance (M-NEW-15)
// Only issues certificates if user has passed the exam server-side
// =============================================
exports.issueCertificate = functionsV1.https.onCall(async (data, context) => {
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');

    const uid = context.auth.uid;
    const { type, name } = data || {};

    if (!type || !['scholar', 'technical', 'trail_meadow', 'trail_mountain', 'trail_summit'].includes(type)) {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Invalid certificate type');
    }

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) throw new functionsV1.https.HttpsError('not-found', 'User not found');
    const userData = userDoc.data();

    // Scholar and protocol certificates require a passed scholar_exam_keys row.
    // Profile flags are not proof. Trail certificates still use trails_passed.
    let passed = false;
    let title = 'Bitcoiner';
    let score = null;

    if (type === 'scholar' || type === 'technical') {
        const examType = type === 'technical' ? 'technical' : 'properties';
        const prior = await db.collection('scholar_exam_keys').where('uid', '==', uid).get();
        const examRow = require('./src/scholarExam').passedExam(prior, examType, null);
        passed = !!examRow;
        title = type === 'technical' ? 'Bitcoin Protocol Expert' : 'Bitcoin Scholar';
        score = examRow && examRow.score != null ? examRow.score : (passed ? 'Passed' : null);
    } else if (type.startsWith('trail_')) {
        // Find the specific trail in the list of passed trails
        const passedTrails = userData.trails_passed || [];
        passed = passedTrails.includes(type.replace('trail_', ''));
        title = 'Nacho Trail Complete';
    }

    if (!passed) {
        throw new functionsV1.https.HttpsError('permission-denied', 'You have not passed the requirements for this certificate.');
    }

    // Generate unique Cert ID
    const certId = 'CERT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase();

    const certData = {
        id: certId,
        uid: uid,
        name: (name || userData.username || 'Bitcoiner').substring(0, 50),
        username: userData.username || null,
        type: type,
        title: title,
        score: score,
        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('certs').doc(certId).set(certData);

    return { success: true, certId: certId, title: title, name: certData.name };
});

// =============================================
// COMMUNITY STATS - server-side increments via triggers
// =============================================
// Prevents client abuse: stats/global is now admin-only writable.
// Each counter is bumped by a Firestore trigger on the authoritative event.

// Chat message posted → bump chatMessages
exports.onChatMessageCreated = onDocumentCreated('global_chat/{msgId}', async (event) => {
    const snap = event.data; const _context = { params: event.params };
        const data = snap.data() || {};
        // Skip bot/nacho/system messages so the counter reflects real users
        if (data.uid === 'nacho-bot' || data.uid === 'system') return null;
        if (data.isNachoAuto === true) return null;
        if (data.uid && String(data.text || '').trim()) {
            await grantServerTickets(data.uid, 'daily_chat_ticket');
        }
        try {
            await db.collection('stats').doc('global').set({
                chatMessages: admin.firestore.FieldValue.increment(1)
            }, { merge: true });
        } catch (e) { console.error('[onChatMessageCreated] failed:', e); }
        const mentioned = data.mentionUid;
        if (mentioned && mentioned !== data.uid && /^[A-Za-z0-9_-]{4,128}$/.test(String(mentioned))) {
            try {
                await sendUserPush(mentioned, 'mentions', {
                    title: 'You were mentioned',
                    body: (data.name || 'Someone') + ' mentioned you in chat.',
                    url: 'https://bitcoineducation.quest/#chat'
                });
            } catch (e) { console.warn('[onChatMessageCreated] mention push failed', e.message); }
        }
        return null;
    });

function _pushUidOk(id) {
    return /^[A-Za-z0-9_-]{4,128}$/.test(String(id || ''));
}

function _pushDisplayName(data, fallback) {
    const name = data && typeof data.username === 'string' ? data.username.trim() : '';
    return name || fallback;
}

function _pushSenderBlocked(recipientData, senderUid) {
    const blocked = recipientData && Array.isArray(recipientData.blockedUsers) ? recipientData.blockedUsers : [];
    return blocked.indexOf(senderUid) !== -1;
}

// Banned accounts and guests never get a push attributed to them.
function _pushSenderEligible(data) {
    if (!data) return false;
    if (data.banned === true) return false;
    if (data.anonymous === true) return false;
    return true;
}

// DM created under a conversation. The recipient's "dms" pref gates delivery.
// The display name is the sender's server username. Client-written senderName is ignored.
exports.onDmMessageCreated = onDocumentCreated('dm_conversations/{cid}/messages/{mid}', async (event) => {
    const snap = event.data;
    if (!snap) return null;
    const msg = snap.data() || {};
    const sender = String(msg.senderUid || '');
    if (!_pushUidOk(sender)) return null;
    try {
        const convo = await db.collection('dm_conversations').doc(event.params.cid).get();
        if (!convo.exists) return null;
        const participants = convo.data().participants || [];
        if (participants.indexOf(sender) === -1) return null;
        const recipient = participants.find(function (id) { return id && id !== sender; });
        if (!_pushUidOk(recipient)) return null;
        const senderSnap = await db.collection('users').doc(sender).get();
        if (!senderSnap.exists || !_pushSenderEligible(senderSnap.data())) return null;
        const recipientSnap = await db.collection('users').doc(recipient).get();
        const recipientData = recipientSnap.exists ? (recipientSnap.data() || {}) : {};
        if (_pushSenderBlocked(recipientData, sender)) return null;
        const preview = msg.imageUrl ? 'Sent you an image' : (msg.text || 'New message');
        await sendUserPush(recipient, 'dms', {
            title: 'Message from ' + _pushDisplayName(senderSnap.data(), 'a Bitcoiner'),
            body: preview,
            url: 'https://bitcoineducation.quest/#dms'
        });
    } catch (e) {
        console.warn('[onDmMessageCreated] push failed', e.message);
    }
    return null;
});

// Marketplace message. The listing document is the source of the seller.
// Client-written sellerUid and buyerName are ignored.
exports.onMarketplaceMessageCreated = onDocumentCreated('marketplace_messages/{id}', async (event) => {
    const snap = event.data;
    if (!snap) return null;
    const msg = snap.data() || {};
    const listingId = String(msg.listingId || '');
    const buyer = String(msg.buyerUid || '');
    if (!listingId || listingId.length > 128 || !_pushUidOk(buyer)) return null;
    try {
        const listing = await db.collection('marketplace').doc(listingId).get();
        if (!listing.exists) return null;
        const seller = String((listing.data() || {}).sellerUid || '');
        if (!_pushUidOk(seller) || seller === buyer) return null;
        const buyerSnap = await db.collection('users').doc(buyer).get();
        if (!buyerSnap.exists || !_pushSenderEligible(buyerSnap.data())) return null;
        const sellerSnap = await db.collection('users').doc(seller).get();
        const sellerData = sellerSnap.exists ? (sellerSnap.data() || {}) : {};
        if (_pushSenderBlocked(sellerData, buyer)) return null;
        await sendUserPush(seller, 'plebtalk', {
            title: 'Marketplace message',
            body: _pushDisplayName(buyerSnap.data(), 'Someone') + ' messaged you about a listing.',
            url: 'https://bitcoineducation.quest/#marketplace'
        });
    } catch (e) {
        console.warn('[onMarketplaceMessageCreated] push failed', e.message);
    }
    return null;
});

// Last registration of a token wins. Also keep at most 10 devices, oldest first.
exports.onPushDeviceWritten = onDocumentWritten({
    document: 'push_tokens/{uid}/devices/{deviceId}',
    timeoutSeconds: 60
}, async (event) => {
    const after = event.data && event.data.after;
    if (!after || !after.exists) return null;
    const uid = String(event.params.uid || '');
    if (!_pushUidOk(uid)) return null;
    try {
        const token = after.get('token');
        if (token) await releaseTokenFromOthers(uid, String(token));
        await capUserDevices(uid, String(event.params.deviceId || ''));
        if (token) {
            const userRef = db.collection('users').doc(uid);
            const userSnap = await userRef.get();
            if (userSnap.exists && userSnap.get('pushEnabled') !== true) {
                await userRef.update({ pushEnabled: true });
                await require('./src/badgeCredit').grantIds(db, admin, uid, familyFor('pushEnabled'));
            }
        }
    } catch (e) {
        console.warn('[onPushDeviceWritten]', e.message);
    }
    return null;
});

exports.onPvpMatchFinished = onDocumentUpdated('pvp_matches/{matchId}', async (event) => {
    const before = (event.data.before && event.data.before.data()) || {};
    const after = (event.data.after && event.data.after.data()) || {};
    const matchId = event.params.matchId;
    const becameFinished = before.status !== 'finished' && after.status === 'finished';
    const becameTerminal = before.status !== after.status
        && (after.status === 'finished' || after.status === 'forfeit');
    if (!becameTerminal) return null;
    if (becameFinished) {
        try {
            await db.collection('stats').doc('global').set({
                pvpMatches: admin.firestore.FieldValue.increment(1)
            }, { merge: true });
        } catch (e) { console.error('[onPvpMatchFinished] stats failed:', e.message); }
    }
    try {
        await settlePvpMatch(matchId, after);
    } catch (e) { console.error('[onPvpMatchFinished] settle failed:', e.message); }
    if (becameFinished) {
        try {
            await activityCounters.recordPvpPlayed(db, admin, after);
            const sides = [after.player1, after.player2];
            for (let si = 0; si < sides.length; si++) {
                const sideUid = sides[si] && sides[si].uid;
                if (sideUid) await grantFamily(db, admin, sideUid, familyFor('pvpWins'));
            }
        } catch (badgeErr) { console.warn('[onPvpMatchFinished] badges', badgeErr && badgeErr.message); }
    }
    return null;
});

// New user doc created → bump userCount + assign plebNumber
exports.onUserDocCreated = onDocumentCreated('users/{uid}', async (event) => {
    const snap = event.data; const context = { params: event.params };
        const uid = context.params.uid;
        try {
            const statsRef = db.collection('stats').doc('global');
            // Use a transaction to atomically increment and read the new count
            const plebNumber = await db.runTransaction(async (t) => {
                const statsDoc = await t.get(statsRef);
                const currentCount = (statsDoc.exists && statsDoc.data().userCount) ? statsDoc.data().userCount : 0;
                const newCount = currentCount + 1;
                t.set(statsRef, { userCount: admin.firestore.FieldValue.increment(1) }, { merge: true });
                return newCount;
            });
            // Write plebNumber back to the user doc if not already set
            const userDocRef = db.collection('users').doc(uid);
            await userDocRef.set({ plebNumber: plebNumber }, { merge: true });
        } catch (e) { console.error('[onUserDocCreated] failed:', e); }
        return null;
    });

// ============================================================
// PUBLIC PROFILES — sanitized mirror of users collection
// Synced by trigger on every user doc write.
// Contains ONLY fields safe to expose to any signed-in user.
// PII (email, known_ips, fingerprint, lightningAddress, nostr, etc.) is never copied.
// ============================================================
const PUBLIC_PROFILE_FIELDS = [
    'username', 'username_lower', 'displayName', 'profilePic', 'faction',
    'country', 'bio', 'twitter', 'website',
    'points', 'weeklyXP', 'monthlyXP', 'level',
    'streak', 'bestStreak', 'totalVisits', 'channelsVisited',
    'visitedChannelsList', 'readChannels',
    'orangeTickets', 'badges', 'visibleBadges', 'hiddenBadges',
    'displayBadge', 'equippedBadge', 'activeTitle',
    'ownedCosmetics', 'spinClosetItems',
    'forumPosts', 'forumReplies',
    'pvpWins', 'pvpLosses',
    'sfTotalHashes', 'sfBlocksFound', 'sfBestHash', 'firstHashAt',
    'raidDamageAllTime', 'raidDamageThisMonth',
    'predictions', 'plebNumber',
    'lastSeen', 'isOnline', 'ghostMode',
    'lightningAddress',   // display-only; tip button uses this
    'lightning',           // alias saved by older clients; tip lookup checks both
    'created', 'createdAt',
    'earnedHidden',
    'peerCount', // peer network size (peers array stays server-only)
];

exports.syncPublicProfile = onDocumentWritten('users/{uid}', async (event) => {
    const change = { before: event.data.before, after: event.data.after }; const context = { params: event.params };
        const uid = context.params.uid;
        const pubRef = db.collection('public_profiles').doc(uid);
        // Deleted user → remove public profile
        if (!change.after.exists) {
            try { await pubRef.delete(); } catch(e) { console.error('[syncPublicProfile] delete failed:', e); }
            return null;
        }
        const data = change.after.data() || {};
        const pub = {};
        PUBLIC_PROFILE_FIELDS.forEach(f => { if (f in data) pub[f] = data[f]; });
        try {
            await pubRef.set(pub, { merge: false });
        } catch(e) { console.error('[syncPublicProfile] write failed:', e); }
        return null;
    });

// Admin-only backfill: copies all existing user docs → public_profiles.
// Call once after deploy: firebase functions:call backfillPublicProfiles (with admin auth)
exports.backfillPublicProfiles = functionsV1.https.onCall(async (data, context) => {
        if (!context.auth || !context.auth.token.get('admin', false)) {
            throw new functionsV1.https.HttpsError('permission-denied', 'Admin only');
        }
        const snap = await db.collection('users').get();
        const batch_size = 400;
        let count = 0;
        let batch = db.batch();
        snap.forEach(doc => {
            const d = doc.data();
            const pub = {};
            PUBLIC_PROFILE_FIELDS.forEach(f => { if (f in d) pub[f] = d[f]; });
            batch.set(db.collection('public_profiles').doc(doc.id), pub, { merge: false });
            count++;
            if (count % batch_size === 0) {
                batch.commit().catch(e => console.error('[backfill] batch commit failed:', e));
                batch = db.batch();
            }
        });
        if (count % batch_size !== 0) await batch.commit();
        console.log('[backfillPublicProfiles] done:', count, 'docs');
        return { success: true, count };
    });

// ---- One-time backfill: copy lightning → lightningAddress for users missing it ----
// Fixes users who saved their address before the dual-field save was deployed.
// Each batch.update() triggers syncPublicProfile, keeping public_profiles in sync.
exports.backfillLightningAddress = functionsV1.https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.token.get('admin', false)) {
        throw new functionsV1.https.HttpsError('permission-denied', 'Admin only');
    }
    const snap = await db.collection('users').get();
    const BATCH_SIZE = 400;
    let batch = db.batch();
    let updated = 0;
    let skipped = 0;
    let batchCount = 0;
    const commits = [];
    snap.forEach(doc => {
        const d = doc.data();
        const lightning = d.lightning || '';
        const lightningAddress = d.lightningAddress || '';
        // Only update if they have a lightning field but lightningAddress is missing or out of sync
        if (lightning && lightning.includes('@') && lightning !== lightningAddress) {
            batch.update(doc.ref, { lightningAddress: lightning });
            updated++;
            batchCount++;
            if (batchCount >= BATCH_SIZE) {
                commits.push(batch.commit());
                batch = db.batch();
                batchCount = 0;
            }
        } else {
            skipped++;
        }
    });
    if (batchCount > 0) commits.push(batch.commit());
    await Promise.all(commits);
    console.log('[backfillLightningAddress] done:', updated, 'updated,', skipped, 'skipped, total:', snap.size);
    return { success: true, updated, skipped, total: snap.size };
});

// ---- Live triggers for community stats: channelVisits, questsCompleted, watchTimeMinutes ----

// Channel visit → bump global channelVisits (detects channelsVisited increment on user doc)
exports.onUserChannelVisit = onDocumentUpdated('users/{uid}', async (event) => {
    const change = { before: event.data.before, after: event.data.after }; const _context = { params: event.params };
        const before = change.before.data() || {};
        const after = change.after.data() || {};
        const beforeVisits = before.channelsVisited || 0;
        const afterVisits = after.channelsVisited || 0;
        if (afterVisits > beforeVisits) {
            const diff = afterVisits - beforeVisits;
            try {
                await db.collection('stats').doc('global').set({
                    channelVisits: admin.firestore.FieldValue.increment(diff)
                }, { merge: true });
            } catch (e) { console.error('[onUserChannelVisit] failed:', e); }
        }
        return null;
    });

// Quest completed → bump global questsCompleted (detects completedQuests array growth)
exports.onUserQuestCompleted = onDocumentUpdated('users/{uid}', async (event) => {
    const change = { before: event.data.before, after: event.data.after }; const _context = { params: event.params };
        const before = change.before.data() || {};
        const after = change.after.data() || {};
        const beforeLen = Array.isArray(before.completedQuests) ? before.completedQuests.length : 0;
        const afterLen = Array.isArray(after.completedQuests) ? after.completedQuests.length : 0;
        if (afterLen > beforeLen) {
            const diff = afterLen - beforeLen;
            try {
                await db.collection('stats').doc('global').set({
                    questsCompleted: admin.firestore.FieldValue.increment(diff)
                }, { merge: true });
            } catch (e) { console.error('[onUserQuestCompleted] failed:', e); }
        }
        return null;
    });

// NOTE: watchTimeMinutes is already incremented client-side every minute
// via direct Firestore set({merge:true}) in app.js TCTV watch tracker.
// No server trigger needed - would double-count.

// ---- One-shot admin reset for community stats (remove after running) ----
exports.resetCommunityStats = functionsV1.https.onCall(async (data, context) => {
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    const email = (context.auth.token.email || '').toLowerCase();
    if (!context.auth.token.admin) {
        throw new functionsV1.https.HttpsError('permission-denied', 'Admin only');
    }

    // Defaults based on Phil's estimate - callable accepts overrides.
    const defaults = {
        channelVisits: 500,
        questsCompleted: 50,
        chatMessages: 40,
        spins: 30,
        pvpMatches: 5,
        userCount: 50,
        watchTimeMinutes: 60,
        resetAt: Date.now(),
        resetBy: email
    };
    const overrides = (data && typeof data === 'object') ? data : {};
    const payload = Object.assign({}, defaults, overrides);

    await db.collection('stats').doc('global').set(payload, { merge: false });

    // Predictions: Phil asked for 33% → 3/10
    const predPayload = {
        total: (overrides.predTotal != null) ? overrides.predTotal : 10,
        correct: (overrides.predCorrect != null) ? overrides.predCorrect : 3,
        resetAt: Date.now(),
        resetBy: email
    };
    await db.collection('stats').doc('predictions').set(predPayload, { merge: false });

    return { success: true, global: payload, predictions: predPayload };
});

// ───────────────────────────────────────────────────────────────
// Daily Active Users - HTTP endpoint (GET). Returns count of users with
// lastActive / lastLogin / lastVisit within the last 24h.
// Usage: curl "https://us-central1-bitcoin-education-archive.cloudfunctions.net/dailyActiveUsers" -H "x-admin-token: $ADMIN_TOKEN"
// ───────────────────────────────────────────────────────────────
exports.dailyActiveUsers = functionsV1.https.onRequest(async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const todayStr = now.toISOString().split('T')[0];
        const yesterdayStr = oneDayAgo.toISOString().split('T')[0];

        const snap = await db.collection('users').get();
        let dau = 0;
        let total = snap.size;
        let activeToday = 0;   // only today (strict)
        let active7d = 0;
        let active30d = 0;
        let newUsers24h = 0;
        let newUsers7d = 0;
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sevenAgoStr = sevenDaysAgo.toISOString().split('T')[0];
        const thirtyAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

        // Auth method breakdown - total users & active-24h per method
        const authTotals = { password: 0, google: 0, twitter: 0, github: 0, facebook: 0, nostr: 0, lightning: 0, anonymous: 0, unknown: 0 };
        const authActive24h = { password: 0, google: 0, twitter: 0, github: 0, facebook: 0, nostr: 0, lightning: 0, anonymous: 0, unknown: 0 };
        const authNew24h = { password: 0, google: 0, twitter: 0, github: 0, facebook: 0, nostr: 0, lightning: 0, anonymous: 0, unknown: 0 };

        // Suspicious signals
        const suspicious = {
            highPointsJump24h: [],     // users with points > 5000 created in last 24h
            duplicateLnAddresses: [],  // lightning addresses appearing in >1 giveaway entry
            nullUsernameActive: 0,     // active users with no username
            sameEmailDomainBurst: []   // email domains with >=5 signups in last 24h
        };
        const emailDomainCounts24h = {};

        function classifyAuth(d) {
            if (d.authMethod === 'lightning') return 'lightning';
            if (d.nostr) return 'nostr';
            if (d.email && d.email.endsWith('@needcreations-auth.local')) return 'password'; // email magic link treated as password-ish
            if (d.authProvider) {
                const p = String(d.authProvider).toLowerCase();
                if (p.includes('google')) return 'google';
                if (p.includes('twitter') || p.includes('x.com')) return 'twitter';
                if (p.includes('github')) return 'github';
                if (p.includes('facebook')) return 'facebook';
                if (p.includes('password') || p.includes('email')) return 'password';
            }
            if (d.email) return 'password';
            if (d.anonymous === true) return 'anonymous';
            return 'unknown';
        }

        const allUserEmails = []; // for pattern matching
        snap.forEach(doc => {
            const d = doc.data();
            if (d.email) allUserEmails.push({ uid: doc.id, email: d.email, username: d.username || '', points: d.points || 0 });
            const method = classifyAuth(d);
            authTotals[method] = (authTotals[method] || 0) + 1;

            let ts = null;
            if (d.lastActive && d.lastActive.toDate) ts = d.lastActive.toDate();
            else if (d.lastLogin && d.lastLogin.toDate) ts = d.lastLogin.toDate();
            let isActive24h = false;
            if (ts) {
                if (ts >= oneDayAgo) { dau++; isActive24h = true; }
                if (ts.toISOString().split('T')[0] === todayStr) activeToday++;
                if (ts >= sevenDaysAgo) active7d++;
                if (ts >= thirtyDaysAgo) active30d++;
            } else if (d.lastVisit) {
                if (d.lastVisit === todayStr || d.lastVisit === yesterdayStr) { dau++; isActive24h = true; }
                if (d.lastVisit === todayStr) activeToday++;
                if (d.lastVisit >= sevenAgoStr) active7d++;
                if (d.lastVisit >= thirtyAgoStr) active30d++;
            }
            if (isActive24h) authActive24h[method] = (authActive24h[method] || 0) + 1;

            // Created timestamp (could be serverTimestamp or undefined on older accounts)
            let createdTs = null;
            if (d.created && d.created.toDate) createdTs = d.created.toDate();
            else if (d.createdAt && d.createdAt.toDate) createdTs = d.createdAt.toDate();
            if (createdTs) {
                if (createdTs >= oneDayAgo) {
                    newUsers24h++;
                    authNew24h[method] = (authNew24h[method] || 0) + 1;
                    if ((d.points || 0) > 5000) {
                        suspicious.highPointsJump24h.push({ uid: doc.id.substring(0,8), points: d.points, method });
                    }
                    if (d.email) {
                        const dom = String(d.email).split('@')[1] || 'unknown';
                        emailDomainCounts24h[dom] = (emailDomainCounts24h[dom] || 0) + 1;
                    }
                }
                if (createdTs >= sevenDaysAgo) newUsers7d++;
            }

            if (isActive24h && !d.username) suspicious.nullUsernameActive++;
        });

        Object.keys(emailDomainCounts24h).forEach(dom => {
            if (emailDomainCounts24h[dom] >= 5) {
                suspicious.sameEmailDomainBurst.push({ domain: dom, count: emailDomainCounts24h[dom] });
            }
        });

        // Known bad actor email pattern detection (Tadiyos ring + similar)
        const KNOWN_PATTERNS = [
            /tadi.*reta|reta.*tadi/i,  // Tadiyos anagram pattern
            /retata/i,
            /roberm.*arch|robert.*march/i, // Robert March variants
        ];
        suspicious.knownPatternMatches = [];
        allUserEmails.forEach(entry => {
            for (const pat of KNOWN_PATTERNS) {
                if (pat.test(entry.email)) {
                    suspicious.knownPatternMatches.push({ uid: entry.uid.substring(0,8), email: entry.email, pattern: pat.source });
                    break;
                }
            }
        });

        // Default username farming detection ("Bitcoiner" accounts with high points)
        suspicious.defaultUsernameFarmers = [];
        allUserEmails.forEach(entry => {
            if (entry.username === 'Bitcoiner' && entry.points > 2000) {
                suspicious.defaultUsernameFarmers.push({ uid: entry.uid.substring(0,8), email: entry.email, points: entry.points });
            }
        });

        // Giveaway entries
        let giveawayCount = 0;
        let giveawayNew24h = 0;
        try {
            const gSnap = await db.collection('giveaway_entries').get();
            giveawayCount = gSnap.size;
            const lnCounts = {};
            gSnap.forEach(gd => {
                const gData = gd.data();
                let gts = null;
                if (gData.createdAt && gData.createdAt.toDate) gts = gData.createdAt.toDate();
                else if (gData.timestamp && gData.timestamp.toDate) gts = gData.timestamp.toDate();
                if (gts && gts >= oneDayAgo) giveawayNew24h++;
                const ln = (gData.lightningAddress || gData.lnAddress || '').toLowerCase().trim();
                if (ln) lnCounts[ln] = (lnCounts[ln] || 0) + 1;
            });
            Object.keys(lnCounts).forEach(ln => {
                if (lnCounts[ln] > 1) suspicious.duplicateLnAddresses.push({ address: ln, count: lnCounts[ln] });
            });
        } catch (ge) { /* collection may not exist */ }

        res.json({
            date: now.toISOString(),
            totalUsers: total,
            dau,
            activeToday,
            active7d,
            active30d,
            newUsers24h,
            newUsers7d,
            authTotals,
            authActive24h,
            authNew24h,
            giveawayCount,
            giveawayNew24h,
            suspicious
        });
    } catch (e) {
        console.error('[dailyActiveUsers] error:', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});




// ===== INVESTIGATE SPECIFIC UIDS (admin-only) =====
// One-shot investigation endpoint: accepts up to 20 UIDs, returns full records +
// cross-referenced signals (same IP, same lightning address, giveaway entries,
// points sources, account age, auth method, bestStreak sanity, etc).
exports.investigateUsers = functionsV1.https.onRequest(async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const uidsParam = req.query.uids || '';
    const uids = uidsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 20);
    if (!uids.length) { res.status(400).json({ error: 'Pass ?uids=UID1,UID2,...' }); return; }
    await logAdminAction(req, 'investigateUsers', { uids: uids.join(',') });

    try {
        const out = [];
        for (const uid of uids) {
            const rec = { uid, exists: false };
            try {
                const doc = await db.collection('users').doc(uid).get();
                if (!doc.exists) { rec.note = 'User doc not found'; out.push(rec); continue; }
                const d = doc.data();
                rec.exists = true;
                rec.username = d.username || null;
                rec.email = d.email || null;
                rec.authProvider = d.authProvider || null;
                rec.authMethod = d.authMethod || null;
                rec.nostr = d.nostr || null;
                rec.lightningAddress = d.lightningAddress || d.lnAddress || null;
                rec.points = d.points || 0;
                rec.totalVisits = d.totalVisits || 0;
                rec.streak = d.streak || 0;
                rec.bestStreak = d.bestStreak || 0;
                rec.channelsVisited = d.channelsVisited || 0;
                rec.visitedChannelsList = Array.isArray(d.visitedChannelsList) ? d.visitedChannelsList.length : (d.visitedChannelsList ? 'non-array' : 0);
                rec.readChannels = Array.isArray(d.readChannels) ? d.readChannels.length : (d.readChannels && typeof d.readChannels === 'object' ? Object.keys(d.readChannels).length : 0);
                rec.orangeTickets = d.orangeTickets || 0;
                rec.created = d.created && d.created.toDate ? d.created.toDate().toISOString() : null;
                rec.lastVisit = d.lastVisit || null;
                rec.lastLogin = d.lastLogin && d.lastLogin.toDate ? d.lastLogin.toDate().toISOString() : null;
                rec.referredBy = d.referredBy || null;
                rec.referrals = d.referrals || 0;
                rec.mergedAnon = d.mergedAnon || false;
                rec.pvpWins = d.pvpWins || 0;
                rec.pvpLosses = d.pvpLosses || 0;
                // Scholar cert + quest signals - may explain point totals above daily cap
                const certKeys = Object.keys(d).filter(k => k.startsWith('certPassed_') || k.startsWith('certPassedAt_'));
                rec.certs = certKeys.reduce((o,k) => { o[k] = d[k]; return o; }, {});
                rec.lastSpinDate = d.lastSpinDate || null;
                rec.spinClosetItems = d.spinClosetItems ? (Array.isArray(d.spinClosetItems) ? d.spinClosetItems.length : 'non-array') : 0;
                rec.questsCompleted = d.questsCompleted || 0;
                rec.badges = Array.isArray(d.badges) ? d.badges.length : (d.badges ? 'non-array' : 0);
                rec.forumPosts = d.forumPosts || 0;
                rec.forumReplies = d.forumReplies || 0;
                rec.beatsUploads = d.beatsUploads || 0;
                // Raw dump of all numeric + boolean fields to surface anything unexpected
                const rawSnapshot = {};
                Object.keys(d).forEach(k => {
                    const v = d[k];
                    if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') {
                        rawSnapshot[k] = v;
                    } else if (v && v.toDate) {
                        rawSnapshot[k] = v.toDate().toISOString();
                    } else if (Array.isArray(v)) {
                        rawSnapshot[k + '_len'] = v.length;
                    }
                });
                rec.raw = rawSnapshot;

                // Firebase Auth metadata
                try {
                    const ur = await admin.auth().getUser(uid);
                    rec.auth = {
                        creationTime: ur.metadata.creationTime,
                        lastSignInTime: ur.metadata.lastSignInTime,
                        lastRefreshTime: ur.metadata.lastRefreshTime || null,
                        disabled: ur.disabled,
                        emailVerified: ur.emailVerified,
                        displayName: ur.displayName || null,
                        providers: (ur.providerData || []).map(p => ({ providerId: p.providerId, email: p.email, uid: p.uid }))
                    };
                    const ageDays = Math.max(0, Math.floor((Date.now() - new Date(ur.metadata.creationTime).getTime()) / 86400000));
                    rec.accountAgeDays = ageDays;
                    // Flag: streak > account age means inflated (shouldn't happen post-fix)
                    if (rec.bestStreak > ageDays + 1) rec.flags = (rec.flags||[]).concat('bestStreak-exceeds-age');
                    if (rec.streak > ageDays + 1) rec.flags = (rec.flags||[]).concat('streak-exceeds-age');
                    // Points-per-day rate
                    if (ageDays > 0) rec.pointsPerDay = Math.round((rec.points / ageDays) * 10) / 10;
                } catch(e) { rec.authError = e.message; }

                // giveaway_entries
                try {
                    const ge = await db.collection('giveaway_entries').doc(uid).get();
                    if (ge.exists) {
                        const g = ge.data();
                        rec.giveaway = {
                            lightningAddress: g.lightningAddress || g.lnAddress || null,
                            createdAt: g.createdAt && g.createdAt.toDate ? g.createdAt.toDate().toISOString() : null
                        };
                    }
                } catch(e) {}

                // daily_points subcollection (recent 10 days)
                try {
                    const dp = await db.collection('users').doc(uid).collection('daily_points').get();
                    const daily = [];
                    dp.forEach(x => { const v = x.data(); daily.push({ date: x.id, pts: v.total || v.points || 0 }); });
                    // Sort by date desc
                    daily.sort((a,b) => (b.date || '').localeCompare(a.date || ''));
                    rec.recentDailyPoints = daily.slice(0, 20);
                    rec.dailyPointsTotal = daily.reduce((a,b) => a + (b.pts||0), 0);
                    rec.dailyPointsDocCount = daily.length;
                } catch(e) { rec.dailyPointsErr = e.message; }
            } catch(e) { rec.error = e.message; }

            out.push(rec);
        }

        // Cross-reference: which fields match across the group?
        const crossref = {
            sameLightningAddress: {},
            sameEmail: {},
            sameDisplayName: {},
            sameReferrer: {},
            accountsCreatedWithin5min: []
        };
        out.forEach(r => {
            if (r.lightningAddress) (crossref.sameLightningAddress[r.lightningAddress] = crossref.sameLightningAddress[r.lightningAddress] || []).push(r.uid);
            if (r.giveaway && r.giveaway.lightningAddress) (crossref.sameLightningAddress[r.giveaway.lightningAddress] = crossref.sameLightningAddress[r.giveaway.lightningAddress] || []).push(r.uid);
            if (r.email) (crossref.sameEmail[r.email] = crossref.sameEmail[r.email] || []).push(r.uid);
            if (r.auth && r.auth.displayName) (crossref.sameDisplayName[r.auth.displayName] = crossref.sameDisplayName[r.auth.displayName] || []).push(r.uid);
            if (r.referredBy) (crossref.sameReferrer[r.referredBy] = crossref.sameReferrer[r.referredBy] || []).push(r.uid);
        });
        // Accounts created within 5 minutes of each other
        const created = out.filter(r => r.auth && r.auth.creationTime).map(r => ({uid: r.uid, ts: new Date(r.auth.creationTime).getTime(), name: r.username}));
        created.sort((a,b) => a.ts - b.ts);
        for (let i = 1; i < created.length; i++) {
            if (created[i].ts - created[i-1].ts < 300000) {
                crossref.accountsCreatedWithin5min.push({
                    a: created[i-1].uid, b: created[i].uid,
                    deltaSec: Math.round((created[i].ts - created[i-1].ts) / 1000)
                });
            }
        }

        res.json({ users: out, crossref });
    } catch (e) {
        console.error('[investigateUsers] error:', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// ===== WATCHLIST MONITOR =====
// Checks a hardcoded list of suspicious UIDs + anyone in the suspicious_activity
// collection for recent changes (points gained, new sats withdrawals, new referrals,
// new giveaway entries). Returns a report for the daily Telegram summary.
const WATCHLIST_UIDS = [
    // Tadiyos multi-account ring flagged 2026-04-22
    '4TbegMVtzYQBgqRSCpqLQwwsgPF2',
    'AeOAPHTZ2EfRsxlsU6nDCSwTNXo2',
    'DTXTjDL1K4afriPLcWTI4pD8JeD2',
    'OZgypkJbY3f6ofTIzbEWKpYKkVu1',      // big account A (10.5k pts)
    'Ol7JfqLGKJcagmMT529EgULFiYN2',
    'cKpILLVtDxNuLBcIX8kD9sGEvhj1',
    'VqLiZRbN0LM6bWeYPcjF6zTZJAk2'       // big account B (11k pts)
];
const BLACKLISTED_LN = [
    'piquantpony23@walletofsatoshi.com',
    'seedyroute27@walletofsatoshi.com'
];

exports.watchlistCheck = functionsV1.https.onRequest(async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        const out = { watchlist: [], suspiciousRecent: [], satsByWatchlist: [], blacklistedLnHits: [], alerts: [] };
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // 1. For each watchlist UID, pull current state and compare to snapshot.
        // We keep a snapshot in watchlist_snapshots/{uid} for daily-delta reporting.
        for (const uid of WATCHLIST_UIDS) {
            try {
                const userDoc = await db.collection('users').doc(uid).get();
                if (!userDoc.exists) { out.watchlist.push({ uid, status: 'deleted' }); continue; }
                const d = userDoc.data();
                const snapRef = db.collection('watchlist_snapshots').doc(uid);
                const snapDoc = await snapRef.get();
                const snap = snapDoc.exists ? snapDoc.data() : {};

                const nowState = {
                    points: d.points || 0,
                    orangeTickets: d.orangeTickets || 0,
                    totalVisits: d.totalVisits || 0,
                    streak: d.streak || 0,
                    lastVisit: d.lastVisit || null,
                    channelsVisited: d.channelsVisited || 0,
                    referralTicketsEarned: d.referralTicketsEarned || 0,
                    disabled: d.disabled || false
                };

                const delta = {};
                Object.keys(nowState).forEach(k => {
                    if (snap[k] != null && typeof nowState[k] === 'number' && nowState[k] !== snap[k]) {
                        delta[k] = nowState[k] - snap[k];
                    } else if (snap[k] !== undefined && snap[k] !== nowState[k]) {
                        delta[k] = { from: snap[k], to: nowState[k] };
                    }
                });

                // Alert conditions
                if (delta.points && delta.points > 0) out.alerts.push(`${uid.substring(0,8)} (${d.username || 'no-name'}) gained ${delta.points} pts since last check`);
                if (delta.orangeTickets && delta.orangeTickets > 0) out.alerts.push(`${uid.substring(0,8)} gained ${delta.orangeTickets} tickets`);
                if (delta.referralTicketsEarned && delta.referralTicketsEarned > 0) out.alerts.push(`${uid.substring(0,8)} earned ${delta.referralTicketsEarned} referral tickets`);

                // Sats withdrawals in last 24h
                try {
                    const satsSnap = await db.collection('users').doc(uid).collection('sats_withdrawals').orderBy('createdAt', 'desc').limit(5).get();
                    const recent = [];
                    satsSnap.forEach(s => {
                        const sd = s.data();
                        const ts = sd.createdAt && sd.createdAt.toDate ? sd.createdAt.toDate() : null;
                        if (ts && ts >= oneDayAgo) recent.push({ sats: sd.sats || sd.amount || 0, at: ts.toISOString() });
                    });
                    if (recent.length) {
                        out.satsByWatchlist.push({ uid: uid.substring(0,8), username: d.username, withdrawals: recent });
                        recent.forEach(w => out.alerts.push(`\u26a0\ufe0f ${uid.substring(0,8)} (${d.username}) WITHDREW ${w.sats} sats at ${w.at}`));
                    }
                } catch (e) {}

                out.watchlist.push({ uid: uid.substring(0,8), username: d.username, delta, current: nowState });

                // Save new snapshot for next run
                await snapRef.set({ ...nowState, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            } catch (e) {
                out.watchlist.push({ uid: uid.substring(0,8), error: e.message });
            }
        }

        // 2. Anything new in suspicious_activity in last 24h?
        try {
            const susSnap = await db.collection('suspicious_activity')
                .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(oneDayAgo))
                .orderBy('createdAt', 'desc').limit(20).get();
            susSnap.forEach(s => {
                const sd = s.data();
                out.suspiciousRecent.push({
                    type: sd.type, flags: sd.flags || [],
                    referrer: sd.referrerUid ? sd.referrerUid.substring(0,8) : null,
                    referred: sd.referredUid ? sd.referredUid.substring(0,8) : null
                });
                out.alerts.push(`\ud83d\udd34 Suspicious: ${sd.type} \u2014 ${(sd.flags||[]).join(', ')}`);
            });
        } catch (e) {}

        // 3. Scan users for blacklisted LN addresses
        try {
            for (const ln of BLACKLISTED_LN) {
                const blSnap = await db.collection('users').where('lightningAddress', '==', ln).get();
                blSnap.forEach(g => {
                    if (!out.blacklistedLnHits.find(h => h.uid === g.id.substring(0,8))) {
                        out.blacklistedLnHits.push({ uid: g.id.substring(0,8), username: (g.data().username||''), ln, withdrawalsDisabled: !!g.data().withdrawalsDisabled });
                    }
                });
            }
            const active = out.blacklistedLnHits.filter(h => !h.withdrawalsDisabled);
            if (active.length > 0) {
                out.alerts.push(`\ud83d\udea8 ${active.length} active accounts with blacklisted LN address (${out.blacklistedLnHits.length} total)`);
            }
        } catch (e) {}

        res.json(out);
    } catch (e) {
        console.error('[watchlistCheck] error:', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =============================================
// AUDIT WITHDRAWALS - Admin endpoint for monitoring blocked accounts & investigating withdrawal clusters
// =============================================
exports.auditWithdrawals = functionsV1.https.onRequest(async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        const out = { blockedAccounts: [], recentWithdrawals: [], ipClusters: [], fingerprintClusters: [] };

        // 1. Find all satsDisabled accounts and their withdrawal history
        const blockedSnap = await db.collection('users').where('satsDisabled', '==', true).get();
        for (const doc of blockedSnap.docs) {
            const d = doc.data();
            const uid = doc.id;
            const record = {
                uid: uid.substring(0, 8),
                uidFull: uid,
                username: d.username || null,
                email: d.email || null,
                points: d.points || 0,
                satsDisabled: true,
                withdrawals: []
            };
            // Pull ALL withdrawal history for this blocked account
            const wSnap = await db.collection('users').doc(uid).collection('sats_withdrawals').orderBy('timestamp', 'desc').limit(50).get();
            wSnap.forEach(w => {
                const wd = w.data();
                record.withdrawals.push({
                    amount: wd.amount || wd.sats || 0,
                    pointsUsed: wd.pointsUsed || 0,
                    timestamp: wd.timestamp && wd.timestamp.toDate ? wd.timestamp.toDate().toISOString() : null,
                    invoice: wd.invoice || null,
                    preimage: wd.preimage ? wd.preimage.substring(0, 16) + '...' : null
                });
            });
            out.blockedAccounts.push(record);
        }

        // 1b. [VULN-7 FIX] Find accounts banned in faucet_ledger but NOT in user doc
        //     (delete+recreate evaders who still have a ledger ban)
        const ledgerBannedSnap = await db.collection('faucet_ledger').where('banned', '==', true).get();
        for (const ldoc of ledgerBannedSnap.docs) {
            const uid = ldoc.id;
            // Skip if already in blockedAccounts from user-doc query
            if (out.blockedAccounts.some(a => a.uidFull === uid)) continue;
            const ld = ldoc.data();
            out.blockedAccounts.push({
                uid: uid.substring(0, 8),
                uidFull: uid,
                username: null, // user doc was deleted
                email: null,
                points: null,
                satsDisabled: 'ledger-only (user doc recreated)',
                ban_reason: ld.ban_reason || 'ledger ban',
                withdrawals: []
            });
        }

        // 2. Query recent withdrawals from faucet_invoices (global log)
        const daysBack = parseInt(req.query.days || '7');
        const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
        const invoiceSnap = await db.collection('faucet_invoices').where('ts', '>=', since).orderBy('ts', 'desc').limit(200).get();
        invoiceSnap.forEach(inv => {
            const id = inv.data();
            out.recentWithdrawals.push({
                uid: id.uid ? id.uid.substring(0, 8) : 'unknown',
                uidFull: id.uid || 'unknown',
                amount: id.amount || 0,
                timestamp: id.ts && id.ts.toDate ? id.ts.toDate().toISOString() : null
            });
        });

        // 3. Check faucet_ip_log for multi-account IPs
        const ipSnap = await db.collection('faucet_ip_log').where('claimCount', '>=', 3).limit(50).get();
        ipSnap.forEach(ip => {
            const ipd = ip.data();
            out.ipClusters.push({
                ip: ip.id.replace(/_/g, '.'),
                uids: (ipd.uids || []).map(u => u.substring(0, 8)),
                uidsFull: ipd.uids || [],
                claimCount: ipd.claimCount || 0,
                lastClaim: ipd.lastClaim && ipd.lastClaim.toDate ? ipd.lastClaim.toDate().toISOString() : null
            });
        });

        // 4. Check faucet_fingerprints for multi-account fingerprints
        const fpSnap = await db.collection('faucet_fingerprints').where('claimCount', '>=', 3).limit(50).get();
        fpSnap.forEach(fp => {
            const fpd = fp.data();
            out.fingerprintClusters.push({
                fingerprint: fp.id.substring(0, 12) + '...',
                uids: (fpd.uids || []).map(u => u.substring(0, 8)),
                uidsFull: fpd.uids || [],
                claimCount: fpd.claimCount || 0,
                lastClaim: fpd.lastClaim && fpd.lastClaim.toDate ? fpd.lastClaim.toDate().toISOString() : null
            });
        });

        // 5. Summary
        out.summary = {
            totalBlockedAccounts: blockedSnap.size,
            totalWithdrawalsInPeriod: out.recentWithdrawals.length,
            blockedAccountsWithWithdrawals: out.blockedAccounts.filter(a => a.withdrawals.length > 0).length,
            multiAccountIPs: out.ipClusters.length,
            multiAccountFingerprints: out.fingerprintClusters.length,
            periodDays: daysBack
        };

        res.json(out);
    } catch (e) {
        console.error('[auditWithdrawals] error:', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =============================================
// TCTV Presence Aggregation - Scalable Live Viewer Counter
// Once a minute.
//   Live count: presence docs whose server timestamp `ts` is inside the last
//   90 seconds (single-field range). One aggregate doc at tctv_counts/live.
//   That write is skipped when the per-station counts did not change.
//   Peak: max of this run's concurrent total, stored on tctv_stats/peak.
//   A stored peak is never lowered and never replaced with a smaller total.
//   Views: manual tune docs in tctv_view_days (deterministic id, one per
//   viewer + channel + UTC day). This job folds only docs with `ts` after
//   the saved cursor, marks them counted, and increments tctv_stats/views.
//   It does not scan either collection and does not reset a stored total.
//   Deletes up to 100 stale presence docs and, once an hour, up to 100 tune
//   docs older than 3 days.
// =============================================
exports.tctvAggregatePresence = onSchedule({
    schedule: 'every 1 minutes',
    timeZone: 'UTC',
    retryCount: 0,
}, async (event) => {
    const tctvPresence = require('./tctv-presence-lib');
    try {
        const now = Date.now();
        const freshStart = admin.firestore.Timestamp.fromMillis(now - tctvPresence.FRESH_MS);
        const freshEnd = admin.firestore.Timestamp.fromMillis(now + tctvPresence.FUTURE_SKEW_MS);
        const staleBefore = admin.firestore.Timestamp.fromMillis(now - tctvPresence.STALE_MS);

        // Range on one field uses the single-field index on ts.
        // Far-future timestamps stay out of this query.
        const presenceSnap = await db.collection('tctv_presence')
            .where('ts', '>=', freshStart)
            .where('ts', '<=', freshEnd)
            .get();

        const counts = {};
        presenceSnap.forEach(doc => {
            tctvPresence.accumulatePresence(counts, doc.data() || {}, now);
        });

        const total = Object.keys(counts).reduce((sum, id) => sum + counts[id], 0);
        const countRef = db.collection('tctv_counts').doc('live');
        const existing = await countRef.get();
        const prev = existing.exists && existing.data() && existing.data().stations && typeof existing.data().stations === 'object'
            ? existing.data().stations
            : null;
        let wrote = false;
        if (!existing.exists || !tctvPresence.stationCountsEqual(prev, counts)) {
            await countRef.set({
                stations: counts,
                total: total,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            wrote = true;
        }

        // Bounded. Docs with no timestamp `ts` are left for functions/cleanup-tctv-presence.js.
        let deleted = 0;
        const staleSnap = await db.collection('tctv_presence')
            .where('ts', '<', staleBefore)
            .orderBy('ts', 'asc')
            .limit(tctvPresence.STALE_DELETE_LIMIT)
            .get();
        if (!staleSnap.empty) {
            const batch = db.batch();
            staleSnap.forEach(doc => {
                batch.delete(doc.ref);
                deleted++;
            });
            await batch.commit();
        }

        let viewsAdded = 0;
        let peakWrote = false;
        try {
            const peakRef = db.collection('tctv_stats').doc('peak');
            const peakPayloadTs = admin.firestore.FieldValue.serverTimestamp();
            peakWrote = await db.runTransaction(async (tx) => {
                const peakSnap = await tx.get(peakRef);
                const storedPeak = peakSnap.exists && peakSnap.data() ? peakSnap.data().peak : null;
                const peakNext = tctvPresence.nextPeak(peakSnap.exists ? storedPeak : null, total);
                if (peakNext == null) return false;
                const peakPayload = { peak: peakNext, ts: peakPayloadTs };
                if (peakSnap.exists) tx.update(peakRef, peakPayload);
                else tx.set(peakRef, peakPayload);
                return true;
            });
        } catch (peakErr) {
            console.error('[TCTV] peak error:', peakErr.message);
        }

        try {
            const cursorRef = db.collection('tctv_stats').doc('view_cursor');
            const cursorSnap = await cursorRef.get();
            const savedCursor = cursorSnap.exists && cursorSnap.data() && typeof cursorSnap.data().ms === 'number'
                ? cursorSnap.data().ms
                : null;
            const cursorMs = savedCursor == null ? now - tctvPresence.VIEW_LOOKBACK_MS : savedCursor;
            const tuneSnap = await db.collection('tctv_view_days')
                .where('ts', '>', admin.firestore.Timestamp.fromMillis(cursorMs))
                .orderBy('ts', 'asc')
                .limit(tctvPresence.VIEW_FOLD_LIMIT)
                .get();

            const tuneDocs = tuneSnap.docs;
            let newestMs = null;
            if (tuneDocs.length) {
                const viewRef = db.collection('tctv_stats').doc('views');
                const expiresAt = admin.firestore.Timestamp.fromMillis(now + tctvPresence.VIEW_TTL_MS);
                viewsAdded = await db.runTransaction(async (tx) => {
                    const viewsSnap = await tx.get(viewRef);
                    const freshRefs = [];
                    for (let i = 0; i < tuneDocs.length; i++) {
                        const fresh = await tx.get(tuneDocs[i].ref);
                        const data = fresh.exists ? (fresh.data() || {}) : null;
                        if (!tctvPresence.validViewDoc(data, tuneDocs[i].id, now)) continue;
                        freshRefs.push(tuneDocs[i].ref);
                    }
                    const storedCount = viewsSnap.exists && viewsSnap.data() ? viewsSnap.data().count : null;
                    const next = tctvPresence.addedViews(viewsSnap.exists ? storedCount : null, freshRefs.length);
                    if (next == null) return 0;
                    for (let i = 0; i < freshRefs.length; i++) {
                        tx.update(freshRefs[i], { counted: true, expiresAt: expiresAt });
                    }
                    const viewPayload = {
                        count: admin.firestore.FieldValue.increment(freshRefs.length),
                        ts: admin.firestore.FieldValue.serverTimestamp(),
                    };
                    // increment keeps an admin-corrected total and only adds
                    // new tunes. A missing doc is created at the new-tune count.
                    if (viewsSnap.exists) tx.update(viewRef, viewPayload);
                    else tx.set(viewRef, {
                        count: next,
                        ts: admin.firestore.FieldValue.serverTimestamp(),
                    });
                    return freshRefs.length;
                });
                newestMs = tctvPresence.timestampMillis(tuneDocs[tuneDocs.length - 1].data() && tuneDocs[tuneDocs.length - 1].data().ts);
            }

            const nextCursor = tctvPresence.advanceViewCursor(
                savedCursor,
                now,
                newestMs,
                tuneDocs.length,
                tctvPresence.VIEW_FOLD_LIMIT
            );
            if (savedCursor == null || nextCursor !== savedCursor) {
                await cursorRef.set({
                    ms: nextCursor,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }

            // Hourly. Tune docs older than the retain window are deleted by
            // the same ts index. Missing or non-timestamp ts is left alone.
            if (new Date(now).getUTCMinutes() === 0) {
                const oldBefore = admin.firestore.Timestamp.fromMillis(now - tctvPresence.VIEW_RETAIN_MS);
                const oldSnap = await db.collection('tctv_view_days')
                    .where('ts', '<', oldBefore)
                    .orderBy('ts', 'asc')
                    .limit(tctvPresence.STALE_DELETE_LIMIT)
                    .get();
                if (!oldSnap.empty) {
                    const batch = db.batch();
                    oldSnap.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                }
            }
        } catch (viewErr) {
            console.error('[TCTV] views error:', viewErr.message);
        }

        console.log('[TCTV] fresh=' + presenceSnap.size + ' stations=' + Object.keys(counts).length + ' viewers=' + total + ' wrote=' + wrote + ' deleted=' + deleted + ' viewsAdded=' + viewsAdded + ' peakWrote=' + peakWrote);
        return null;
    } catch (e) {
        console.error('[TCTV] Aggregation error:', e.message);
        return null;
    }
});

// ==========================================
// PROOF OF WALK (STRAVA INTEGRATION)
// ==========================================

// Step 1: generate a server-side CSRF nonce tied to the authenticated uid.
// Frontend calls this BEFORE redirecting to Strava; uses the returned nonce
// as `state=` instead of the raw uid so the callback can't be forged.
exports.stravaInitAuth = functionsV1.https.onCall(async (data, context) => {
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    const provider = (context.auth.token.firebase || {}).sign_in_provider || '';
    if (provider === 'anonymous') {
        throw new functionsV1.https.HttpsError('permission-denied', 'Anonymous users cannot connect Strava');
    }
    const crypto = require('crypto');
    const nonce = crypto.randomBytes(32).toString('hex'); // 256-bit unguessable
    const expiresAt = Date.now() + 10 * 60 * 1000;       // 10-minute TTL
    await db.collection('strava_nonces').doc(nonce).set({
        uid: context.auth.uid,
        expiresAt,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { nonce };
});

// Step 2: Strava redirects here with ?code=...&state=<nonce>.
// We look up the nonce server-side, extract the real uid, delete it
// (one-time use), then proceed with the token exchange.
exports.stravaAuth = functionsV1.https.onRequest(async (req, res) => {
    try {
        const code  = req.query.code;
        const nonce = req.query.state; // server-issued nonce, NOT a raw uid

        if (!code || !nonce) {
            return res.redirect('https://bitcoineducation.quest/#explore?strava=error-missing-params');
        }

        // Validate nonce: fetch, delete immediately (replay-safe), then verify TTL
        const nonceRef = db.collection('strava_nonces').doc(nonce);
        const nonceDoc = await nonceRef.get();
        if (!nonceDoc.exists) {
            return res.redirect('https://bitcoineducation.quest/#explore?strava=error-invalid-state');
        }
        const { uid, expiresAt } = nonceDoc.data();
        await nonceRef.delete(); // consume before any network I/O — prevents replay on timeout
        if (!uid || Date.now() > expiresAt) {
            return res.redirect('https://bitcoineducation.quest/#explore?strava=error-expired-state');
        }

        const client_id = process.env.STRAVA_CLIENT_ID;
        const client_secret = process.env.STRAVA_CLIENT_SECRET;

        if (!client_id || !client_secret) {
            console.error("Missing Strava credentials in .env");
            return res.redirect('https://bitcoineducation.quest/#explore?strava=config-error');
        }

        const response = await fetch('https://www.strava.com/api/v3/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: client_id,
                client_secret: client_secret,
                code: code,
                grant_type: 'authorization_code'
            })
        });

        const data = await response.json();

        if (data.access_token) {
            await db.collection('users').doc(uid).collection('integrations').doc('strava').set({
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                expires_at: data.expires_at,
                athlete_id: data.athlete ? data.athlete.id : null,
                athlete_name: data.athlete ? (data.athlete.firstname + ' ' + data.athlete.lastname).trim() : 'Athlete',
                athlete_profile: data.athlete ? data.athlete.profile : '',
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
            await grantServerTickets(uid, 'strava_connect_ticket', {
                athleteId: data.athlete && data.athlete.id,
            });
            return res.redirect('https://bitcoineducation.quest/#explore?strava=success');
        } else {
            console.error("Strava exchange error:", data);
            return res.redirect('https://bitcoineducation.quest/#explore?strava=error-exchange');
        }
    } catch (e) {
        console.error('Strava Auth Error:', e);
        return res.redirect('https://bitcoineducation.quest/#explore?strava=error');
    }
});

exports.syncStravaWalks = functionsV1.https.onCall(async (data, context) => {
    console.log('[POW] syncStravaWalks called');
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Must be logged in');
    const uid = context.auth.uid;
    console.log('[POW] uid:', uid);

    const stravaRef = db.collection('users').doc(uid).collection('integrations').doc('strava');
    const stravaDoc = await stravaRef.get();
    if (!stravaDoc.exists) throw new functionsV1.https.HttpsError('not-found', 'Strava not connected');

    let tokenData = stravaDoc.data();
    let access_token = tokenData.access_token;
    console.log('[POW] token expires_at:', tokenData.expires_at, 'now:', Math.floor(Date.now()/1000));

    // Refresh token if expired (buffer of 5 mins)
    if (Date.now() / 1000 > (tokenData.expires_at - 300)) {
        const resp = await fetch('https://www.strava.com/api/v3/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: process.env.STRAVA_CLIENT_ID,
                client_secret: process.env.STRAVA_CLIENT_SECRET,
                refresh_token: tokenData.refresh_token,
                grant_type: 'refresh_token'
            })
        });
        const refreshed = await resp.json();
        if (refreshed.access_token) {
            access_token = refreshed.access_token;
            await stravaRef.update({
                access_token: refreshed.access_token,
                refresh_token: refreshed.refresh_token,
                expires_at: refreshed.expires_at
            });
        } else {
            throw new functionsV1.https.HttpsError('permission-denied', 'Strava auth expired, please reconnect');
        }
    }

    // Fetch recent activities
    const actResp = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=30', {
        headers: { 'Authorization': `Bearer ${access_token}` }
    });
    const activities = await actResp.json();
    console.log('[POW] Strava returned', Array.isArray(activities) ? activities.length + ' activities' : JSON.stringify(activities).substring(0, 200));
    if (!Array.isArray(activities)) {
        console.error('[POW] Strava API Failed', activities);
        throw new functionsV1.https.HttpsError('internal', 'Strava API failed: ' + JSON.stringify(activities).substring(0, 100));
    }

    let totalPoints = 0;
    let syncedCount = 0;
    let powPointsBefore = 0;
    const results = [];

    const userRef = db.collection('users').doc(uid);
    const statsRef = userRef.collection('proof_of_walk_stats').doc('daily');
    const ledgerRef = db.collection('faucet_ledger').doc(uid);
    const walk = require('./src/proofOfWalk');
    const { rewardBlocked } = require('./src/cipherClaim');
    const { applyDailyXp } = require('./src/applyDailyXp');

    // Filter eligible activities first
    const eligible = activities.filter(act => walk.WALK_TYPES.includes(act.type));
    if (eligible.length === 0) return { success: true, synced: 0, pointsEarned: 0, activities: [] };

    // Atomic transaction - all reads first, then all writes (Firestore requirement).
    // Several past dates can arrive in one sync. Their XP is summed and tapered
    // once against today's shared counter. Anything over the cap is dropped.
    await db.runTransaction(async (transaction) => {
        totalPoints = 0;
        syncedCount = 0;
        results.length = 0;

        const dailyDoc = await transaction.get(statsRef);
        const userDoc = await transaction.get(userRef);
        const ledgerDoc = await transaction.get(ledgerRef);
        const actRefs = [];
        const actDocs = [];
        for (const act of eligible) {
            const ref = userRef.collection('proof_of_walk').doc(act.id.toString());
            actRefs.push(ref);
            actDocs.push(await transaction.get(ref));
        }

        const already = {};
        for (let i = 0; i < eligible.length; i++) {
            if (actDocs[i].exists) already[eligible[i].id.toString()] = true;
        }
        const userData = userDoc.exists ? (userDoc.data() || {}) : {};
        powPointsBefore = userData.points || 0;
        const plan = walk.planWalkSync({
            activities: eligible,
            already: already,
            dailyData: dailyDoc.exists ? (dailyDoc.data() || {}) : { date: '', distance: 0 },
        });
        const blocked = rewardBlocked(userData, ledgerDoc.exists ? (ledgerDoc.data() || {}) : {});
        const grant = await applyDailyXp(uid, blocked ? 0 : plan.rawPoints, transaction, {
            day: getOffsetDateKey(),
            userRef: userRef,
        });

        // A ban pays nothing and does not consume the activities.
        // A full daily cap still records them so the extra XP is not saved for later.
        if (blocked || plan.synced === 0) return;

        const refById = {};
        for (let i = 0; i < eligible.length; i++) refById[eligible[i].id.toString()] = actRefs[i];
        plan.rows.forEach(function (row) {
            results.push(row);
            transaction.set(refById[row.id], {
                distance: row.distance,
                points_awarded: row.points,
                date: row.date,
                type: row.type,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
        });
        transaction.set(statsRef, plan.dailyData);
        totalPoints = grant.awarded;
        syncedCount = plan.synced;
        if (grant.awarded > 0) {
            transaction.update(userRef, {
                points: admin.firestore.FieldValue.increment(grant.awarded),
                weeklyXP: admin.firestore.FieldValue.increment(grant.awarded),
                monthlyXP: admin.firestore.FieldValue.increment(grant.awarded),
            });
            transaction.set(grant.dailyRef, {
                total: grant.dailyXp,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
    });

    console.log('[POW] Done. synced:', syncedCount, 'pts:', totalPoints);
    if (totalPoints > 0) {
        await rewardNotify.safeCommit(db, admin.firestore.FieldValue.serverTimestamp(), rewardNotify.plan({
            uid: uid,
            onceKey: 'walk_' + Date.now(),
            xp: totalPoints,
            sourceLabel: 'Proof of Walk',
            icon: '👟',
            pointsBefore: powPointsBefore,
            pointsDelta: totalPoints,
        }));
    }
    return { success: true, synced: syncedCount, pointsEarned: totalPoints, activities: results };
});
exports.adminLookupUser = functionsV1.https.onRequest(async (req, res) => {
    if (!requireAdmin(req, res)) return;
    await logAdminAction(req, 'adminLookupUser', { q: req.query.q });
    try {
        let q = req.query.q;
        let snap1 = await db.collection('users').where('email', '==', q).get();
        let snap2 = await db.collection('users').where('displayName', '==', q).get();
        let out = [];
        snap1.forEach(d => out.push({uid: d.id, ...d.data()}));
        snap2.forEach(d => { if (!out.find(x => x.uid === d.id)) out.push({uid: d.id, ...d.data()}); });
        res.json(out);
    } catch(e) { console.error('[adminLookupUser] error:', e); res.status(500).json({error: 'Internal server error'}); }
});
exports.adminQueryUsers = functionsV1.https.onRequest(async (req, res) => {
    if (!requireAdmin(req, res)) return;
    await logAdminAction(req, 'adminQueryUsers', { q: req.query.q });
    try {
        let snap = await db.collection('users').get();
        let matches = [];
        let q = req.query.q ? req.query.q.toLowerCase() : '';
        snap.forEach(d => {
            let u = d.data();
            if (q) {
                if ((u.email && u.email.toLowerCase().includes(q)) || (u.displayName && u.displayName.toLowerCase().includes(q)) || d.id === q) {
                    matches.push({uid: d.id, email: u.email, displayName: u.displayName, points: u.points, flags: u.flagged, ban_reason: u.ban_reason, withdraw_disabled: u.withdrawals_disabled, ip: u.known_ips});
                }
            }
        });
        res.json(matches);
    } catch(e) { console.error('[adminQueryUsers] error:', e); res.status(500).json({error: 'Internal server error'});}
});
// [VULN-7 FIX] adminBanUser — sets ban flags in BOTH user doc and faucet_ledger atomically.
// The ledger ban survives user-doc deletion (faucet_ledger is write:false for clients).
exports.adminBanUser = functionsV1.https.onRequest(async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        const uid = req.query.uid;
        const reason = (req.query.reason || 'admin ban').substring(0, 200);
        if (!uid) return res.status(400).json({error: 'uid required'});
        await logAdminAction(req, 'adminBanUser', { uid, reason });
        const batch = db.batch();
        batch.update(db.collection('users').doc(uid), {
            withdrawals_disabled: true,
            satsDisabled: true,
            flagged: true,
            ban_reason: reason,
        });
        // Mirror into server-only ledger so delete+recreate can't shake the ban
        batch.set(db.collection('faucet_ledger').doc(uid), {
            banned: true,
            ban_reason: reason,
            bannedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        await batch.commit();
        console.log('[adminBanUser] Banned uid:', uid, 'reason:', reason);
        res.json({success: true, uid});
    } catch(e) { console.error('[adminBanUser] error:', e); res.status(500).json({error: 'Internal server error'});}
});

exports.adminUnbanUser = functionsV1.https.onRequest(async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        const uid = req.query.uid;
        if (!uid) return res.status(400).json({error: 'uid required'});
        await logAdminAction(req, 'adminUnbanUser', { uid });
        // [VULN-7 FIX] Unban atomically in both user doc AND faucet_ledger.
        // Both must be cleared so a re-banned user can't exploit a stale ledger state.
        const batch = db.batch();
        batch.update(db.collection('users').doc(uid), {
            withdrawals_disabled: false,
            satsDisabled: false,
            flagged: false,
            flag_reason: admin.firestore.FieldValue.delete(),
            ban_reason: admin.firestore.FieldValue.delete(),
            _pendingClaim: admin.firestore.FieldValue.delete(),
            _pendingClaimAt: admin.firestore.FieldValue.delete(),
        });
        // Clear the ledger ban. set+merge so the doc is created if it doesn't exist yet.
        batch.set(db.collection('faucet_ledger').doc(uid), {
            banned: false,
            ban_reason: admin.firestore.FieldValue.delete(),
            bannedAt: admin.firestore.FieldValue.delete(),
        }, { merge: true });
        await batch.commit();
        res.json({success: true, uid});
    } catch(e) { console.error('[adminUnbanUser] error:', e); res.status(500).json({error: 'Internal server error'});}
});

// ===== RAID BOSS =====
const { scheduleRaidBoss } = require('./src/scheduleRaidBoss');
const { contributeRaid } = require('./src/contributeRaid');
exports.scheduleRaidBoss = scheduleRaidBoss;
exports.contributeRaid = contributeRaid;

// ===== SATOSHI'S FAVOR =====
const { contributeFavor, hashForFavor, checkFavorState, getFavorHashes, syncCycleToTop10, backfillFactionTotals, getFactionTotals } = require('./src/satoshiFavor');
exports.contributeFavor = contributeFavor;
exports.hashForFavor = hashForFavor;
exports.checkFavorState = checkFavorState;
exports.getFavorHashes = getFavorHashes;
exports.syncCycleToTop10 = syncCycleToTop10;
exports.backfillFactionTotals = backfillFactionTotals;
exports.getFactionTotals = getFactionTotals;

// Scheduled job: auto-reset expired Satoshi's Favor every minute (even with 0 users online)
exports.satoshiFavorAutoReset = onSchedule({ schedule: '* * * * *', timeZone: 'UTC' }, async (event) => {
    const stateRef = db.collection('satoshiFavor').doc('current');
    const stateDoc = await stateRef.get();
    if (!stateDoc.exists) return;

    const stateData = stateDoc.data();
    if (!stateData.favorActive) return;

    const now = Date.now();
    const favorEndBase = stateData.favorEndBase ? stateData.favorEndBase.toMillis() : 0;
    const bonusMs = (stateData.bonusMinutes || 0) * 60 * 1000;
    const effectiveEnd = favorEndBase + bonusMs;

    if (now > effectiveEnd) {
        // Archive window stats BEFORE resetting
        try {
            const lastWindowRef = db.collection('satoshiFavor').doc('lastWindow');
            const DIFFICULTY_TARGET = 10000; // keep in sync with satoshiFavor.js
            await lastWindowRef.set({
                cycleId: stateData.currentCycleId || null,
                startedAt: stateData.favorStart || null,
                endedAt: admin.firestore.Timestamp.fromMillis(effectiveEnd),
                durationMinutes: (function() {
                    if (!stateData.favorStart) return 0;
                    const durMs = effectiveEnd - stateData.favorStart.toMillis();
                    return durMs > 0 ? Math.round(durMs / 60000) : 0;
                })(),
                totalHashes: stateData.totalHashes || 0,
                lowestHash: stateData.lowestHashThisWindow || null,
                difficultyTarget: DIFFICULTY_TARGET,
                winner: stateData.lowestHashThisWindowUid ? {
                    uid: stateData.lowestHashThisWindowUid,
                    username: stateData.lowestHashThisWindowUsername || null,
                } : null,
                archivedAt: admin.firestore.Timestamp.now(),
                archivedBy: 'cron',
            }, { merge: false });
            console.log('[SF-CRON] Archived lastWindow — hashes:', stateData.totalHashes || 0, 'lowest:', stateData.lowestHashThisWindow || 'none');
        } catch (e) {
            console.warn('[SF-CRON] Failed to archive lastWindow:', e.message);
        }
        // Reset state
        await stateRef.set({
            points: 0,
            favorActive: false,
            favorStart: null,
            favorEndBase: null,
            bonusMinutes: 0,
            totalHashes: 0,
            lowestHashThisWindow: null,
            lowestHashThisWindowUid: null,
            lowestHashThisWindowUsername: null,
            lastReset: admin.firestore.Timestamp.now(),
            currentCycleId: stateData.currentCycleId || null,
        });
        console.log('[SF-CRON] Auto-reset expired favor at', new Date().toISOString());
    }
});

// ===== TELEGRAM REACTION BRIDGE =====
const { handleTelegramReaction, setTelegramWebhook } = require('./src/handleTelegramReaction');
exports.handleTelegramWebhook = handleTelegramReaction;
exports.setTelegramWebhook = setTelegramWebhook;

// ===== DONATE XP FOR CHARITY =====
exports.donatePoints = functionsV1.https.onCall(async (data, context) => {
    await secondFactor.requireSecondFactor(secondFactor.stamp(data, context));
    if (!context.auth || !context.auth.uid) throw new functionsV1.https.HttpsError('unauthenticated', 'Sign in to donate.');
    if (context.auth.token.firebase && context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functionsV1.https.HttpsError('permission-denied', 'Create an account to donate.');
    }

    const uid = context.auth.uid;
    const amount = Math.floor(Number(data.amount));
    const anonymous = data.anonymous === true;

    if (!amount || amount < 1) throw new functionsV1.https.HttpsError('invalid-argument', 'Donation must be at least 1 point.');
    if (amount > 1000000) throw new functionsV1.https.HttpsError('invalid-argument', 'Donation too large.');

    const db = admin.firestore();
    const userRef = db.collection('users').doc(uid);
    const statsRef = db.collection('charity_stats').doc('global');
    const donationRef = db.collection('charity_donations').doc();

    // Badge tier thresholds -> [minTotal, badgeId, badgePts]
    const DONATION_BADGES = [
        [100,    'donor_100',    50],
        [500,    'donor_500',    150],
        [1000,   'donor_1000',   300],
        [5000,   'donor_5000',   1000],
        [10000,  'donor_10000',  2000],
        [25000,  'donor_25000',  4000],
        [50000,  'donor_50000',  7500],
        [100000, 'donor_100000', 15000],
    ];

    let newBadges = [];
    let bonusPts = 0;

    await db.runTransaction(async (tx) => {
        const userDoc = await tx.get(userRef);
        if (!userDoc.exists) throw new functionsV1.https.HttpsError('not-found', 'User not found.');
        const u = userDoc.data();

        const points = u.points || 0;
        const pointsClaimed = u.pointsClaimed || 0;
        const pointsDonated = u.pointsDonated || 0;
        const pointsExchanged = u.pointsExchanged || 0;
        const available = points - pointsClaimed - pointsDonated - pointsExchanged;

        // Faction required - donations must be attributed to a side
        if (!u.faction || (u.faction !== 'cyber_hornets' && u.faction !== 'honey_badgers')) {
            throw new functionsV1.https.HttpsError('failed-precondition',
                'You must choose a faction (Cyber Hornets or Honey Badgers) before donating.');
        }

        if (available < amount) {
            throw new functionsV1.https.HttpsError('failed-precondition',
                `Not enough available points. You have ${available.toLocaleString()} pts available.`);
        }

        const newTotal = pointsDonated + amount;

        // Check which badges are newly earned
        const existingBadges = Array.isArray(u.donationBadges) ? u.donationBadges : [];
        for (const [threshold, badgeId, badgePtsAward] of DONATION_BADGES) {
            if (newTotal >= threshold && !existingBadges.includes(badgeId)) {
                newBadges.push(badgeId);
                bonusPts += badgePtsAward;
            }
        }

        const ts = admin.firestore.FieldValue.serverTimestamp();
        const donateRankPrev = await rewardNotify.readRankPrev(tx, db, uid, points, bonusPts);

        // Update user doc
        const today = new Date().toISOString().split('T')[0];

        // Award 1 orange ticket if donation >= 1000 XP, once per day (5 AM UTC reset)
        let donationTicket = 0;
        const _donateOffsetToday = getOffsetDateKey();
        const donationTicketRef = userRef.collection('daily_action_counts').doc(_donateOffsetToday + '_donate_ticket');
        const donationTicketDoc = await tx.get(donationTicketRef);
        if (amount >= 1000 && !donationTicketDoc.exists) {
            donationTicket = 1;
            tx.set(donationTicketRef, { awardedAt: admin.firestore.FieldValue.serverTimestamp(), amount });
        }

        const userUpdate = {
            pointsDonated: admin.firestore.FieldValue.increment(amount),
        };
        if (newBadges.length > 0) {
            userUpdate.donationBadges = admin.firestore.FieldValue.arrayUnion(...newBadges);
        }
        if (donationTicket > 0) {
            userUpdate.orangeTickets = admin.firestore.FieldValue.increment(donationTicket);
        }
        tx.update(userRef, userUpdate);
        try {
            const donatePlans = rewardNotify.plan({
                uid: uid,
                onceKey: 'donate_' + Date.now(),
                tickets: donationTicket,
                icon: '🧡',
                message: (donationTicket > 0)
                    ? ('Donated ' + amount.toLocaleString('en-US') + ' XP and +' + donationTicket + ' 🎟️')
                    : ('Donated ' + amount.toLocaleString('en-US') + ' XP'),
            });
            newBadges.forEach(function(badgeId) {
                donatePlans.push.apply(donatePlans, rewardNotify.plan({ uid: uid, badgeId: badgeId }));
            });
            rewardNotify.apply(tx, db, admin.firestore.FieldValue.serverTimestamp(), donatePlans);
        } catch (notifyErr) {
            console.warn('[DONATE] reward notify skipped:', notifyErr && notifyErr.message);
        }

        // Write donation record
        tx.set(donationRef, {
            uid: uid,
            username: anonymous ? 'Anonymous' : (u.username || 'Anonymous'),
            faction: u.faction || null,
            amount: amount,
            anonymous: anonymous,
            ts: ts,
        });

        // Update global charity stats (faction totals always recorded)
        const factionKey = u.faction === 'cyber_hornets' ? 'cyber_hornets'
                         : u.faction === 'honey_badgers' ? 'honey_badgers'
                         : 'no_faction';
        // MUST use update() so dot-notation keys are treated as nested field paths.
        // set+merge stores them as literal string keys like "factionTotals.cyber_hornets" instead
        // of merging into the nested factionTotals map — causing the UI to show wrong totals.
        const statsUpdate = {
            totalDonated: admin.firestore.FieldValue.increment(amount),
            updatedAt: ts,
            [`factionTotals.${factionKey}`]: admin.firestore.FieldValue.increment(amount),
        };
        tx.update(statsRef, statsUpdate);
    });

    bonusPts = 0;
    try {
        const grants = await grantFamily(db, admin, uid, familyFor('pointsDonated'));
        (grants || []).forEach(function (grant) {
            if (grant && grant.granted) bonusPts += grant.xp || 0;
        });
    } catch (donateBadgeErr) {
        console.warn('[DONATE] badges', donateBadgeErr && donateBadgeErr.message);
    }

    return { success: true, newBadges, bonusPts, donationTicket };
});

// ===== LEADERBOARD USER SEARCH =====
// Fetches top users ordered by points, filters by substring match (case-insensitive),
// returns matched users with their true rank. Supports cursor-based pagination.
exports.searchUsers = functionsV1.https.onCall(async (data, context) => {
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');

    const query = ((data.query || '').trim()).toLowerCase();
    if (!query || query.length < 2) return { users: [], hasMore: false };

    const pageSize = parseInt(data.pageSize) || 10;
    const afterRank = parseInt(data.afterRank) || 0;

    // ── Run both queries in parallel for speed ──────────────────────────────
    // Path 1: fast prefix search on username_lower index
    // Path 2: top-500 ranked scan for substring / missing-index fallback
    const PREFIX_LIMIT = 200;
    const SCAN_LIMIT = 500;
    const [prefixSnap, scanSnap] = await Promise.all([
        db.collection('users')
            .where('username_lower', '>=', query)
            .where('username_lower', '<=', query + '\uf8ff')
            .limit(PREFIX_LIMIT)
            .get(),
        db.collection('users')
            .where('points', '>', 0)
            .orderBy('points', 'desc')
            .limit(SCAN_LIMIT)
            .get()
    ]);

    const seenUids = new Set();
    const prefixDocs = [];
    prefixSnap.forEach(doc => {
        const d = doc.data();
        if (d.ghostMode) return;
        seenUids.add(doc.id);
        prefixDocs.push({ id: doc.id, data: d });
    });

    const scanDocs = [];
    scanSnap.forEach(doc => {
        if (seenUids.has(doc.id)) return; // already have from prefix path
        const d = doc.data();
        if (d.ghostMode) return;
        const name = (d.username || '').toLowerCase();
        if (!name.includes(query)) return;
        scanDocs.push({ id: doc.id, data: d });
    });

    // ── Merge, assign global rank from scan order, sort by points ───────────
    // Build a points-desc index from the scan for rank assignment.
    // Prefix-only docs get rank = 9999 (not in top-500, but still valid results).
    const rankMap = new Map();
    let ri = 0;
    scanSnap.forEach(doc => { rankMap.set(doc.id, ++ri); });

    // For users not in the top-500 scan, fetch their real rank by counting
    // how many users have more points. Batch these lookups in parallel.
    const needRankDocs = prefixDocs.filter(({ id }) => !rankMap.has(id) && (prefixDocs.find(p => p.id === id)?.data?.points || 0) > 0);
    const rankFetches = await Promise.all(
        needRankDocs.map(({ id, data: d }) =>
            db.collection('users')
                .where('points', '>', d.points || 0)
                .count()
                .get()
                .then(snap => ({ id, rank: snap.data().count + 1 }))
                .catch(() => ({ id, rank: null }))
        )
    );
    rankFetches.forEach(({ id, rank }) => { if (rank !== null) rankMap.set(id, rank); });

    const toEntry = ({ id, data: d }) => ({
        uid: id,
        username: d.username || 'Anon',
        points: d.points || 0,
        rank: rankMap.get(id) || null,
        faction: d.faction || null,
        country: d.country || null,
        lightningAddress: d.lightningAddress || d.lightning || null,
    });

    const merged = [
        ...prefixDocs.map(toEntry),
        ...scanDocs.map(toEntry),
    ].sort((a, b) => b.points - a.points);

    // Pagination by rank cursor
    const page = afterRank > 0 ? merged.filter(u => u.rank > afterRank) : merged;
    const results = page.slice(0, pageSize);
    const hasMore = page.length > pageSize;

    return { users: results, hasMore };
});


// ================================================================
// ⚡ V4V Split Relay — fan-out zap to multiple Lightning recipients
// POST body: { trackId, amountSats }
// Returns: { invoices: [{name, split, amountSats, invoice, qr}], totalSats }
// ================================================================
exports.v4vSplitRelay = functionsV1.https.onCall(async (data, context) => {
    await secondFactor.requireSecondFactor(secondFactor.stamp(data, context));
    // SECURITY: auth required — unauthenticated callers could use this as a free SSRF oracle
    // via fetchLnurlInvoice and read internal service responses from the reflected pr field.
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Sign in required.');
    if (context.auth.token.firebase && context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functionsV1.https.HttpsError('permission-denied', 'Account required.');
    }
    const uid = context.auth.uid;

    // Rate limit: 10 requests per 60s per user (prevents SSRF enumeration + invoice spam)
    const _v4vRlRef = admin.firestore().collection('rate_limits').doc('v4v_' + uid);
    await admin.firestore().runTransaction(async (tx) => {
        const _rlDoc = await tx.get(_v4vRlRef);
        if (_rlDoc.exists) {
            const { count, windowStart } = _rlDoc.data();
            const age = Date.now() - (windowStart && windowStart.toDate ? windowStart.toDate().getTime() : 0);
            if (age < 60000 && count >= 10) {
                throw new functionsV1.https.HttpsError('resource-exhausted', 'Too many requests. Try again shortly.');
            }
            tx.set(_v4vRlRef, age >= 60000
                ? { count: 1, windowStart: admin.firestore.FieldValue.serverTimestamp() }
                : { count: count + 1, windowStart: _rlDoc.data().windowStart });
        } else {
            tx.set(_v4vRlRef, { count: 1, windowStart: admin.firestore.FieldValue.serverTimestamp() });
        }
    });

    const { trackId, amountSats } = data || {};
    if (!trackId) throw new functionsV1.https.HttpsError('invalid-argument', 'trackId required');
    if (!amountSats || amountSats < 10) throw new functionsV1.https.HttpsError('invalid-argument', 'amountSats must be >= 10');
    if (amountSats > 10000000) throw new functionsV1.https.HttpsError('invalid-argument', 'amountSats too large');

    const trackDoc = await admin.firestore().collection('beats_tracks').doc(trackId).get();
    if (!trackDoc.exists) throw new functionsV1.https.HttpsError('not-found', 'Track not found');
    const track    = trackDoc.data();
    if (track.hidden === true) throw new functionsV1.https.HttpsError('not-found', 'Track not found');
    const splits   = (track.v4vSplits || []).filter(s => s.split > 0);

    if (splits.length === 0) throw new functionsV1.https.HttpsError('failed-precondition', 'No V4V splits defined for this track');

    // Normalise splits to sum=100
    const totalSplit = splits.reduce((s, r) => s + r.split, 0);

    // Build invoice requests
    const invoices = [];
    for (const recipient of splits) {
        const fraction    = recipient.split / totalSplit;
        const recipSats   = Math.max(1, Math.round(amountSats * fraction));
        const recipMsats  = recipSats * 1000;
        const payType     = recipient.paymentType || 'keysend';
        const ln          = (recipient.lightningAddress || '').trim();
        const nodeAddress = (recipient.nodeAddress || '').trim();
        const customKey   = recipient.customKey   || '';
        const customValue = recipient.customValue || '';

        let paymentRequest = null;
        let keysendData    = null;
        let displayAddress = '';

        try {
            if (payType === 'lnaddress' && ln.includes('@')) {
                // Standard LNURL-pay Lightning address — fetch invoice server-side
                paymentRequest = await fetchLnurlInvoice(ln, recipMsats, `V4V: ${beatsCensor(track.title)}`);
                displayAddress = ln;
            } else if (payType === 'keysend_wavlake') {
                // Wavlake keysend — use client-side webln.keysend
                // Return the node info; client handles the actual keysend
                keysendData = { nodeAddress, customKey: customKey || '16180339', customValue, platform: 'wavlake' };
                displayAddress = `Wavlake (${recipient.name})`;
            } else if (payType === 'keysend' && nodeAddress) {
                // Generic keysend node — client-side webln.keysend
                keysendData = { nodeAddress, customKey, customValue };
                displayAddress = nodeAddress.slice(0,16) + '…';
            }
        } catch(e) {
            const domainOnly = String(ln || '').split('@')[1] || '';
            console.error('[v4vSplitRelay] Error for ' + payType + ' domain=' + domainOnly);
        }

        invoices.push({
            name:             recipient.name,
            split:            recipient.split,
            splitPct:         Math.round(fraction * 100),
            amountSats:       recipSats,
            paymentType:      payType,
            lightningAddress: ln,
            displayAddress,
            invoice:          paymentRequest,
            keysend:          keysendData,
            qr:               paymentRequest
                ? await QRCode.toDataURL('lightning:' + paymentRequest, {
                    width: 200,
                    margin: 2,
                    color: { dark: '#ffffff', light: '#1a1a2e' },
                  }).catch(() => null)
                : null,
            canPayLnurl:      !!paymentRequest,
            canKeysend:       !!keysendData,
            canPay:           !!(paymentRequest || keysendData)
        });
    }

    // Log the split event
    try {
        await admin.firestore().collection('beats_v4v_events').add({
            trackId,
            trackTitle:  track.title || '',
            amountSats,
            splits:      invoices.map(i => ({ name: i.name, sats: i.amountSats, splitPct: i.splitPct })),
            createdAt:   admin.firestore.FieldValue.serverTimestamp()
        });
    } catch(e) { /* non-blocking */ }

    return { invoices, totalSats: amountSats, trackTitle: track.title };
});

// Helper: fetch LNURL-pay invoice for a Lightning address.
// Same resolver as claimSats: cross-host callbacks are allowed, amounts are
// not clamped, and failures log the domain only.
async function fetchLnurlInvoice(lightningAddress, msats, comment) {
    const normalized = normalizeLnAddress(lightningAddress);
    const host = (normalized.split('@')[1] || '').split(':')[0].toLowerCase();
    const _isPrivateHost = (
        host === 'localhost' ||
        /^127\./.test(host) ||
        /^10\./.test(host) ||
        /^192\.168\./.test(host) ||
        /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host) ||
        /^169\.254\./.test(host) ||
        /^::1$/.test(host) ||
        /^fd[0-9a-f]{2}:/i.test(host) ||
        /^\d+\.\d+\.\d+\.\d+$/.test(host)
    );
    if (_isPrivateHost || !host || host.length < 3 || host.indexOf('.') === -1) {
        console.error('[fetchLnurlInvoice] SSRF BLOCKED domain=' + host);
        throw new Error('Invalid Lightning Address domain.');
    }
    await assertPublicHost(host);
    try {
        const resolved = await resolveLnurlInvoice({
            address: normalized,
            msats: msats,
            comment: comment,
        });
        return resolved.pr;
    } catch (e) {
        console.error('[fetchLnurlInvoice] failed domain=' + host);
        throw e;
    }
}

// ===== BACKFILL DONATION FACTION =====
// When a user picks their faction for the first time, attribute any charity
// donations they made under 'no_faction' (or with null faction) to their new faction.
exports.backfillDonationFaction = functionsV1.https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.uid) throw new functionsV1.https.HttpsError('unauthenticated', 'Sign in required.');
    if (context.auth.token.firebase && context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functionsV1.https.HttpsError('permission-denied', 'Account required.');
    }

    const uid = context.auth.uid;
    const newFaction = (data.newFaction || '').trim();
    if (newFaction !== 'cyber_hornets' && newFaction !== 'honey_badgers') {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Valid faction required.');
    }

    const db = admin.firestore();

    // Find all this user's donations that have no faction or are 'no_faction'
    const donationsSnap = await db.collection('charity_donations')
        .where('uid', '==', uid)
        .get();

    const toBackfill = [];
    let totalAmount = 0;
    donationsSnap.forEach(doc => {
        const d = doc.data();
        if (!d.faction || d.faction === 'no_faction') {
            toBackfill.push({ ref: doc.ref, amount: d.amount || 0 });
            totalAmount += (d.amount || 0);
        }
    });

    if (toBackfill.length === 0) {
        return { success: true, backfilled: 0, totalAmount: 0 };
    }

    // Batch update: stamp faction on each donation doc + update stats
    const batch = db.batch();
    toBackfill.forEach(({ ref }) => {
        batch.update(ref, { faction: newFaction });
    });

    // Update charity_stats: move amount from no_faction → newFaction
    const statsRef = db.collection('charity_stats').doc('global');
    batch.update(statsRef, {
        [`factionTotals.${newFaction}`]: admin.firestore.FieldValue.increment(totalAmount),
        [`factionTotals.no_faction`]: admin.firestore.FieldValue.increment(-totalAmount),
    });

    await batch.commit();

    console.log(`[CHARITY-BACKFILL] uid=${uid} backfilled ${toBackfill.length} donations (${totalAmount} XP) → ${newFaction}`);
    return { success: true, backfilled: toBackfill.length, totalAmount };
});

// ══════════════════════════════════════════════════════════════════════
// 📅 BACKFILL: Join Dates
// One-shot HTTP trigger — fills `created` field for users missing it.
// Uses Firebase Auth creationTime as ground truth; point-rank estimate as fallback.
// ══════════════════════════════════════════════════════════════════════
exports.backfillJoinDates = functionsV1.https.onRequest(async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const dryRun = req.query.dry === '1';

    const LAUNCH_DATE = new Date('2026-03-01T00:00:00Z');
    const NOW = new Date();

    try {
        // Fetch all Firestore user docs
        const snap = await db.collection('users').get();
        const allUsers = snap.docs.map(d => ({ id: d.id, data: d.data() }));
        console.log('[backfillJoinDates] Total user docs:', allUsers.length);

        // Fetch all Firebase Auth users for creationTime
        const authMap = {};
        let pageToken;
        do {
            const listResult = await admin.auth().listUsers(1000, pageToken);
            listResult.users.forEach(u => {
                if (u.metadata && u.metadata.creationTime) {
                    authMap[u.uid] = new Date(u.metadata.creationTime);
                }
            });
            pageToken = listResult.pageToken;
        } while (pageToken);
        console.log('[backfillJoinDates] Auth users fetched:', Object.keys(authMap).length);

        // Build point-rank list for estimation fallback
        const pointRanked = allUsers
            .filter(u => (u.data.points || 0) > 0)
            .sort((a, b) => (b.data.points || 0) - (a.data.points || 0));
        const totalRanked = pointRanked.length || 1;

        let toUpdate = [];
        let skipped = 0;

        for (const { id, data } of allUsers) {
            // Already has a valid created field? Skip.
            const existing = data.created || data.createdAt;
            if (existing) {
                try {
                    const d = existing.toDate ? existing.toDate() : (existing.seconds ? new Date(existing.seconds * 1000) : new Date(existing));
                    if (!isNaN(d.getTime())) { skipped++; continue; }
                } catch(e) {}
            }

            let createdDate = null;
            let method = 'estimate';

            // 1. Firebase Auth creationTime (ground truth)
            if (authMap[id]) {
                createdDate = authMap[id];
                method = 'auth';
            }

            // 2. Point-rank interpolation
            if (!createdDate) {
                const rank = pointRanked.findIndex(u => u.id === id);
                const fraction = rank >= 0 ? (rank / totalRanked) : 1;
                const msRange = NOW.getTime() - LAUNCH_DATE.getTime();
                createdDate = new Date(LAUNCH_DATE.getTime() + fraction * msRange);
                method = 'estimate';
            }

            toUpdate.push({ id, createdDate, method, username: data.username || '(anon)' });
        }

        console.log('[backfillJoinDates] To update:', toUpdate.length, 'Skipped (already set):', skipped);

        if (!dryRun && toUpdate.length > 0) {
            const CHUNK = 400;
            for (let i = 0; i < toUpdate.length; i += CHUNK) {
                const chunk = toUpdate.slice(i, i + CHUNK);
                const batch = db.batch();
                chunk.forEach(({ id, createdDate }) => {
                    batch.update(db.collection('users').doc(id), {
                        created: admin.firestore.Timestamp.fromDate(createdDate),
                    });
                });
                await batch.commit();
            }
        }

        const authCount = toUpdate.filter(u => u.method === 'auth').length;
        const estCount = toUpdate.filter(u => u.method === 'estimate').length;

        res.json({
            ok: true,
            dryRun,
            totalDocs: allUsers.length,
            alreadySet: skipped,
            updated: toUpdate.length,
            byMethod: { auth: authCount, estimate: estCount },
            sample: toUpdate.slice(0, 10).map(u => ({
                username: u.username,
                method: u.method,
                date: u.createdDate.toISOString().substring(0, 10),
            })),
        });
    } catch (err) {
        console.error('[backfillJoinDates] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════
// ⏰ FEATURE 3: Weekly/Monthly XP Reset + Ticket Prizes
// ══════════════════════════════════════════════════════════════════════

async function _awardTicketsToUser(uid, ticketCount, reason) {
    const userRef = db.collection('users').doc(uid);
    // Award tickets + queue a login-toast notification
    await userRef.update({
        orangeTickets: admin.firestore.FieldValue.increment(ticketCount),
        pendingLeaderboardReward: admin.firestore.FieldValue.arrayUnion({
            tickets: ticketCount,
            reason: reason,
            awardedAt: Date.now()
        })
    });
    // Bell feed. Same grant, display-only, written with the ticket update above.
    await rewardNotify.safeCommit(db, admin.firestore.FieldValue.serverTimestamp(), rewardNotify.plan({
        uid: uid,
        tickets: ticketCount,
        sourceLabel: reason,
        icon: '🏆',
        type: 'leaderboard_reward',
        onceKey: 'lb_' + Date.now(),
    }));
    try {
        await sendUserPush(uid, 'rewards', {
            title: 'You won a reward',
            body: reason + ' — ' + ticketCount + ' Orange Tickets were added.',
            url: 'https://bitcoineducation.quest/#questhub'
        });
    } catch (e) { console.warn('[leaderboard] push failed', e.message); }
}

async function _resetPeriodXP(periodField, winnerKey, ticketsPerWinner, label) {
    const BATCH_SIZE = 499;
    // Get top 10 winners before reset
    const topSnap = await db.collection('users').orderBy(periodField, 'desc').limit(10).get();
    const winners = [];
    topSnap.forEach(doc => {
        const d = doc.data();
        if ((d[periodField] || 0) > 0) {
            winners.push({ uid: doc.id, username: d.username || 'Anon', xp: d[periodField] || 0 });
        }
    });
    for (let wi = 0; wi < winners.length; wi++) {
        const stored = winners[wi].username ? String(winners[wi].username).trim() : '';
        if (stored && stored !== 'Anon' && stored !== 'Anonymous') continue;
        try {
            const pub = await db.collection('public_profiles').doc(winners[wi].uid).get();
            const pubName = pub.exists ? String((pub.data() || {}).username || '').trim() : '';
            if (pubName && pubName !== 'Anon' && pubName !== 'Anonymous') {
                winners[wi].username = pubName.slice(0, 40);
            }
        } catch (e) {
            console.warn('[leaderboard] public name lookup failed');
        }
    }

    // Award tickets to winners
    const awardPromises = winners.map((w, i) =>
        _awardTicketsToUser(w.uid, ticketsPerWinner, `${label} Top ${i + 1}!`)
    );
    await Promise.all(awardPromises);

    // Store winners for history
    if (winners.length > 0) {
        await db.collection('leaderboard_winners').doc(winnerKey).set({
            period: winnerKey,
            label,
            winners,
            uids: winners.map(function(w) { return w.uid; }),
            ticketsPerWinner,
            settledAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }

    // Reset ALL users' period XP in batches
    let lastDoc = null;
    let processed = 0;
    while (true) {
        let query = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(BATCH_SIZE);
        if (lastDoc) query = query.startAfter(lastDoc);
        const snap = await query.get();
        if (snap.empty) break;
        lastDoc = snap.docs[snap.docs.length - 1];
        const batch = db.batch();
        snap.forEach(doc => {
            if ((doc.data()[periodField] || 0) > 0) {
                batch.update(doc.ref, { [periodField]: 0 });
            }
        });
        await batch.commit();
        processed += snap.size;
        if (snap.size < BATCH_SIZE) break;
    }

    console.log(`[LEADERBOARD RESET] ${label}: ${winners.length} winners, ${processed} users reset`);
    return { winners: winners.length, processed, label };
}

// Rewards start from July 2026 onwards — skip June entirely.
// Weekly: skip any week that ends before 2026-07-01.
// Monthly: skip any month reset where the completed month is before 2026-07 (i.e. June 2026 and earlier).
const REWARDS_START_DATE = new Date('2026-07-01T00:00:00Z');

exports.resetWeeklyXP = onSchedule({ schedule: '0 5 * * 1', timeZone: 'UTC' }, async (ctx) => { // Monday 5 AM UTC — consistent with daily reset boundary
    const now = new Date();
    // Skip weeks that end before rewards start date
    if (now < REWARDS_START_DATE) {
        console.log('[WEEKLY RESET] Skipping — rewards start July 2026. Resetting XP without awarding tickets.');
        // Still reset XP so the board is clean, just no ticket awards
        const year = now.getFullYear();
        const startOfYear = new Date(year, 0, 1);
        const weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
        const prevWeek = weekNum - 1;
        const weekKey = `${year}-W${String(prevWeek || 52).padStart(2, '0')}`;
        await _resetPeriodXP('weeklyXP', weekKey, 0, `Week ${weekKey} (no rewards yet)`);
        return null;
    }
    const year = now.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
    const prevWeek = weekNum - 1;
    const weekKey = `${year}-W${String(prevWeek || 52).padStart(2, '0')}`;
    const result = await _resetPeriodXP('weeklyXP', weekKey, 25, `Week ${weekKey}`);
    console.log('[WEEKLY RESET COMPLETE]', result);
    return null;
});

exports.resetMonthlyXP = onSchedule({ schedule: '0 0 1 * *', timeZone: 'UTC' }, async (ctx) => {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthKey = `${prevMonth.getFullYear()}-M${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
    // Skip June 2026 and any earlier month
    if (prevMonth < REWARDS_START_DATE) {
        console.log('[MONTHLY RESET] Skipping ticket awards for', monthKey, '— rewards start July 2026. Resetting XP only.');
        await _resetPeriodXP('monthlyXP', monthKey, 0, `Month ${monthKey} (no rewards yet)`);
        return null;
    }
    const result = await _resetPeriodXP('monthlyXP', monthKey, 100, `Month ${monthKey}`);
    console.log('[MONTHLY RESET COMPLETE]', result);

    return null;
});

// ══════════════════════════════════════════════════════════════════════
// 🎫 MONTHLY RAFFLE DRAW — runs 1pm ET (18:00 UTC) on the 1st of each month
// Draws a winner from raffleEntries, posts as Nacho in global_chat,
// archives snapshot, then resets all raffleEntries to 0 for the new month.
// ══════════════════════════════════════════════════════════════════════
exports.monthlyRaffleDraw = onSchedule({ schedule: '0 18 1 * *', timeZone: 'UTC' }, async (ctx) => {
    const crypto = require('crypto');
    const now = new Date();
    // monthKey for the month that just ended (previous month)
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = prevMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    console.log(`[RAFFLE DRAW] Running for month: ${monthKey} (${monthLabel})`);

    const snapRef = db.collection('stats').doc('raffle_' + monthKey + '_snapshot');
    const existingDraw = await snapRef.get();
    if (existingDraw.exists) {
        console.log('[RAFFLE DRAW] Snapshot already exists — skipping.');
        return null;
    }

    // 1. Fetch all users with raffleEntries > 0
    const snap = await db.collection('users').where('raffleEntries', '>', 0).get();
    if (snap.empty) {
        console.log('[RAFFLE DRAW] No entries found — skipping draw.');
        return null;
    }

    // 2. Build pool — no exclusions at draw time (multi-account enforcement is done upstream)
    const pool = [];
    snap.forEach(doc => {
        const d = doc.data();
        if (d.withdrawalsDisabled || d.banned === true || d.ban_reason || d.satsDisabled === true) return;
        pool.push({ uid: doc.id, username: d.username || 'Unknown', entries: d.raffleEntries || 0 });
    });

    if (pool.length === 0) {
        console.log('[RAFFLE DRAW] No eligible entries after filtering — skipping.');
        return null;
    }

    const total = pool.reduce((s, e) => s + e.entries, 0);

    // 3. CSPRNG draw with rejection sampling (no modulo bias)
    function secureRandInt(max) {
        const bytesNeeded = Math.ceil(Math.log2(max) / 8) + 1;
        const maxUnbiased = Math.floor(Math.pow(256, bytesNeeded) / max) * max;
        for (let i = 0; i < 1000; i++) {
            const buf = crypto.randomBytes(bytesNeeded);
            let val = 0;
            for (let b = 0; b < bytesNeeded; b++) val = val * 256 + buf[b];
            if (val < maxUnbiased) return val % max;
        }
        return crypto.randomBytes(4).readUInt32BE(0) % max; // fallback
    }

    const pick = secureRandInt(total);
    let cumulative = 0;
    let winner = null;
    for (const entry of pool) {
        cumulative += entry.entries;
        if (pick < cumulative) { winner = entry; break; }
    }

    if (!winner) {
        console.error('[RAFFLE DRAW] Winner selection failed — pool:', pool.length, 'total:', total);
        return null;
    }

    console.log(`[RAFFLE DRAW] Winner: ${winner.username} (${winner.entries} entries, pick #${pick + 1} of ${total})`);

    // 4. Archive snapshot
    const archiveData = {};
    snap.forEach(doc => {
        const d = doc.data();
        archiveData[doc.id] = { username: d.username, entries: d.raffleEntries, excluded: !!d.withdrawalsDisabled };
    });
    let raffleWinCredited = false;
    await db.runTransaction(async function (tx) {
        const again = await tx.get(snapRef);
        const winnerRef = db.collection('users').doc(winner.uid);
        const winnerDoc = await tx.get(winnerRef);
        if (again.exists) return;
        const winnerUser = winnerDoc.exists ? (winnerDoc.data() || {}) : {};
        const winPlan = require('./src/badgeProgress').planRaffleWinner({ user: winnerUser });
        tx.set(snapRef, {
            month: monthKey,
            drawnAt: admin.firestore.FieldValue.serverTimestamp(),
            winner: winner.username,
            winnerUid: winner.uid,
            winningPick: pick + 1,
            totalEligibleEntries: total,
            eligibleEntrants: pool.length,
            allEntrants: archiveData,
        });
        if (!winPlan.skip && winnerDoc.exists) {
            tx.update(winnerRef, { raffleWins: admin.firestore.FieldValue.increment(1) });
            raffleWinCredited = true;
        }
    });
    if (raffleWinCredited) {
        try { await require('./src/badgeCredit').grantIds(db, admin, winner.uid, familyFor('raffleWins')); }
        catch (e) { console.warn('[RAFFLE DRAW] badge', e.message); }
    }

    // 5. Post winner announcement to global_chat as Nacho
    const msg = `🎉🦌 ORANGE TICKET RAFFLE — ${monthLabel.toUpperCase()} RESULTS!\n\nThe draw has been made! 🍊\n\n🏆 THIS MONTH'S WINNER IS...\n\n✨ @${winner.username} ✨\n\nCongratulations! Pick #${pick + 1} out of ${total} — your ${winner.entries} entries delivered! ⚡🎫\n\nPhil will be in touch to arrange your 21,000 sats prize. Make sure your Lightning Address is set in your profile settings!\n\n—\n📊 Draw stats:\n• ${pool.length} eligible entrants · ${total} entries\n• Drawn using cryptographically secure randomness 🔐\n\nKeep stacking those orange tickets — every quest, trivia, spin and daily streak earns you entries next month! 🦌🍊⚡`;

    await db.collection('global_chat').add({
        uid: 'nacho-bot',
        name: '🦌 Nacho',
        text: msg,
        mentionUid: winner.uid,
        isNachoAuto: false,
        ts: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('[RAFFLE DRAW] Announcement posted to global_chat.');
    await rewardNotify.safeCommit(db, admin.firestore.FieldValue.serverTimestamp(), rewardNotify.plan({
        uid: winner.uid,
        onceKey: 'raffle_win_' + monthKey,
        icon: '🏆',
        message: '🏆 You won the ' + monthLabel + ' raffle! Phil will arrange your 21,000 sats prize.',
    }));
    try {
        await sendUserPush(winner.uid, 'rewards', {
            title: 'Raffle win',
            body: 'You won this month\'s Orange Ticket raffle.',
            url: 'https://bitcoineducation.quest/#questhub'
        });
    } catch (e) { console.warn('[RAFFLE DRAW] push failed', e.message); }

    // 6. Reset all raffleEntries to 0 — new month starts clean
    const allWithEntries = await db.collection('users').where('raffleEntries', '>', 0).get();
    if (!allWithEntries.empty) {
        const BATCH_SIZE = 200;
        const docs = allWithEntries.docs;
        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
            const batch = db.batch();
            const raffleTs = admin.firestore.FieldValue.serverTimestamp();
            docs.slice(i, i + BATCH_SIZE).forEach(function(doc) {
                batch.update(doc.ref, { raffleEntries: 0 });
                rewardNotify.apply(batch, db, raffleTs, rewardNotify.plan({
                    uid: doc.id,
                    onceKey: 'raffle_reset_' + monthKey,
                    icon: '🎟️',
                    message: '🎟️ Raffle entries reset for the new month',
                }));
            });
            await batch.commit();
        }
        console.log(`[RAFFLE DRAW] Reset raffleEntries for ${docs.length} users — ${monthKey + 1} raffle is open.`);
    }

    return null;
});

// Count topic comments that are still visible a day after they were posted.
exports.creditMatureTopicComments = onSchedule({
    schedule: '15 5 * * *',
    timeZone: 'UTC',
    timeoutSeconds: 540,
}, async () => {
    const result = await require('./src/badgeCredit').creditMatureTopicComments(db, admin, Date.now(), 400);
    console.log('[topic badges] scanned ' + result.scanned + ', credited ' + result.credited);
    return null;
});

// ══════════════════════════════════════════════════════════════════════
// 🧊 FEATURE 5: Spend Orange Tickets for Streak Freezes
// ══════════════════════════════════════════════════════════════════════

exports.spendTicketsForFreeze = functionsV1.https.onCall(async (data, context) => {
    await secondFactor.requireSecondFactor(secondFactor.stamp(data, context));
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    if (context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functionsV1.https.HttpsError('permission-denied', 'Anonymous users cannot purchase freezes');
    }

    const uid = context.auth.uid;
    const amount = parseInt(data.amount) || 1;
    if (![1, 3].indexOf(amount) === -1 && amount !== 1 && amount !== 3) {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Amount must be 1 or 3');
    }

    const FREEZE_COSTS = { 1: 5, 3: 12 }; // tickets per freeze bundle
    const ticketCost = FREEZE_COSTS[amount] || 5;

    const userRef = db.collection('users').doc(uid);
    const result = await db.runTransaction(async (t) => {
        const doc = await t.get(userRef);
        if (!doc.exists) throw new functionsV1.https.HttpsError('not-found', 'User not found');
        const userData = doc.data();
        const currentTickets = userData.orangeTickets || 0;
        const currentFreezes = userData.streakFreezes || 0;

        if (currentTickets < ticketCost) {
            throw new functionsV1.https.HttpsError('resource-exhausted',
                `Not enough tickets. You have ${currentTickets} but need ${ticketCost}.`);
        }

        const update = {
            orangeTickets: admin.firestore.FieldValue.increment(-ticketCost),
            streakFreezes: admin.firestore.FieldValue.increment(amount),
            shopPurchases: admin.firestore.FieldValue.increment(1),
        };
        t.update(userRef, update);
        try {
            rewardNotify.apply(t, db, admin.firestore.FieldValue.serverTimestamp(), rewardNotify.plan({
                uid: uid,
                onceKey: 'freeze_buy_' + Date.now(),
                tickets: -ticketCost,
                freezes: amount,
                sourceLabel: 'buying streak freezes',
                icon: '🧊',
            }));
        } catch (notifyErr) {
            console.warn('[FREEZE] reward notify skipped:', notifyErr && notifyErr.message);
        }
        return {
            newTickets: currentTickets - ticketCost,
            newFreezes: currentFreezes + amount,
        };
    });

    try { await require('./src/badgeCredit').grantIds(db, admin, uid, familyFor('shopPurchases')); }
    catch (e) { console.warn('[FREEZE] badges', e.message); }
    return { success: true, ...result };
});

// ══════════════════════════════════════════════════════════════════════
// 🌍 FEATURE 6: Weekly Community Challenge - progress tracking
// ══════════════════════════════════════════════════════════════════════

// Helper to get current week key (YYYY-WNN)
function _getCurrentWeekKey() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
    return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// Seed the first community challenge
exports.seedWeeklyChallenge = functionsV1.https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.token.admin) {
        throw new functionsV1.https.HttpsError('permission-denied', 'Admin only');
    }
    const weekKey = data.weekKey || _getCurrentWeekKey();
    await db.collection('weekly_challenges').doc(weekKey).set({
        weekKey,
        title: data.title || 'The Bitcoin Basics Blitz',
        description: data.description || 'Complete quizzes and answer trivia questions as a community this week.',
        goals: data.goals || [
            { type: 'quiz_completions', target: 50, label: '50 Quizzes Completed' },
            { type: 'trivia_answers', target: 200, label: '200 Trivia Answers' },
        ],
        progress: { quiz_completions: 0, trivia_answers: 0 },
        completed: false,
        sfBoostActive: false,
        startDate: data.startDate || '2026-06-30',
        endDate: data.endDate || '2026-07-06',
    }, { merge: true });
    return { success: true, weekKey };
});

// Increment community challenge progress (called from client - quiz completion, trivia correct)
exports.incrementWeeklyChallenge = functionsV1.https.onCall(async (data, context) => {
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    // [SECURITY FIX] Block anonymous users — previously only checked context.auth exists.
    // Anonymous accounts are free to create; an attacker could spam N anonymous UIDs
    // and solo-complete the community challenge, triggering the SF boost and badge awards.
    if (context.auth.token.firebase && context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functionsV1.https.HttpsError('permission-denied', 'Anonymous users cannot contribute to weekly challenges');
    }
    const uid = context.auth.uid;

    const goalType = (data.goalType || '').replace(/[^a-z_]/g, '').substring(0, 30);
    if (!goalType) throw new functionsV1.https.HttpsError('invalid-argument', 'goalType required');

    const weekKey = _getCurrentWeekKey();
    const challengeRef = db.collection('weekly_challenges').doc(weekKey);
    // Per-user per-goalType contribution cap for this week
    // Stored in a subcollection so the cap check is atomic with the increment.
    const userContribRef = challengeRef.collection('user_contribs').doc(`${uid}_${goalType}`);

    const snap = await challengeRef.get();
    if (!snap.exists) return { success: false, reason: 'No active challenge' };

    const data2 = snap.data();
    if (data2.completed) return { success: false, reason: 'Already completed' };

    // Check if this goal type is valid
    const validGoal = (data2.goals || []).find(g => g.type === goalType);
    if (!validGoal) return { success: false, reason: 'Invalid goal type' };

    // [SECURITY FIX] Per-user cap: no single user can contribute more than 10% of the
    // goal target (min 1, max 50). Previously there was no cap at all — one authenticated
    // user could call in a loop and solo-complete the entire community challenge.
    const userCap = validGoal.userCap || Math.min(50, Math.max(1, Math.ceil(validGoal.target / 10)));

    // Atomic: read user contrib count, enforce cap, increment both in one transaction
    const { alreadyCapped, newContrib } = await db.runTransaction(async (tx) => {
        const contribDoc = await tx.get(userContribRef);
        const currentContrib = contribDoc.exists ? (contribDoc.data().count || 0) : 0;
        if (currentContrib >= userCap) {
            return { alreadyCapped: true, newContrib: currentContrib };
        }
        tx.set(userContribRef, { count: admin.firestore.FieldValue.increment(1) }, { merge: true });
        tx.update(challengeRef, {
            [`progress.${goalType}`]: admin.firestore.FieldValue.increment(1),
            [`participants.${uid}`]: true,
        });
        return { alreadyCapped: false, newContrib: currentContrib + 1 };
    });

    if (alreadyCapped) return { success: false, reason: 'Weekly contribution cap reached for this goal' };

    // Check if all goals completed (re-read)
    const updated = (await challengeRef.get()).data();
    const allDone = (updated.goals || []).every(g => (updated.progress[g.type] || 0) >= g.target);

    if (allDone && !updated.completed) {
        // Activate SF boost + mark complete
        await challengeRef.update({
            completed: true,
            sfBoostActive: true,
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`[WEEKLY CHALLENGE] ${weekKey} COMPLETED! SF boost activated.`);
        // Award weekly_hero badge to all participants
        const participants = Object.keys(updated.participants || {});
        for (const puid of participants.slice(0, 500)) { // limit to 500 participants
            try {
                const hero = await awardBadge(db, admin, puid, 'weekly_hero', { verified: true, source: 'weekly_hero' });
                if (hero && hero.granted) {
                    try {
                        await rewardNotify.safeCommit(db, admin.firestore.FieldValue.serverTimestamp(), rewardNotify.plan({
                            uid: puid,
                            badgeId: 'weekly_hero',
                            xp: hero.xp || 0,
                            sourceLabel: 'the weekly challenge',
                            icon: '🏆',
                            onceKey: 'weekly_hero_' + weekKey,
                        }));
                    } catch (notifyErr) { console.warn('[WEEKLY CHALLENGE] notify', notifyErr && notifyErr.message); }
                    try {
                        await sendUserPush(puid, 'rewards', {
                            title: 'Weekly challenge complete',
                            body: 'You earned the weekly hero badge.',
                            url: 'https://bitcoineducation.quest/#questhub'
                        });
                    } catch (pushErr) { console.warn('[WEEKLY CHALLENGE] push failed', pushErr.message); }
                }
            } catch (e) { console.error('[WEEKLY CHALLENGE] participant award error', puid, e); }
        }
    }

    return { success: true, allDone };
});

// ══════════════════════════════════════════════════════════════════════
// 🦌 NACHO'S NOOK — Shop Cloud Functions
// ══════════════════════════════════════════════════════════════════════

// Item catalog — server is the authority on all prices/types
const NOOK_SHOP_ITEMS = {
    'streak_freeze':    { cost: 5,   type: 'consumable', name: 'Streak Freeze',           gives: { streakFreezes: 1 } },
    'hash_booster':     { cost: 10,  type: 'consumable', name: 'Hash Booster',            gives: { hashBoosters: 1 } },
    'hint_token':       { cost: 3,   type: 'consumable', name: 'Hint Token',              gives: { hintTokens: 1 } },
    'double_xp':        { cost: 15,  type: 'consumable', name: 'Double XP (60 min)',      gives: { doubleXP: 1 } },
    'bonus_spin':       { cost: 5,   type: 'consumable', name: 'Bonus Spin',              gives: { bonusSpins: 1 } },
    'profile_frame':    { cost: 50,  type: 'cosmetic',   name: 'Profile Frame',           gives: { cosmetics: 'profile_frame' } },
    'chat_flair':       { cost: 40,  type: 'cosmetic',   name: 'Chat Flair',              gives: { cosmetics: 'chat_flair' } },
    'pinned_badge':     { cost: 20,  type: 'cosmetic',   name: 'Pinned Badge',            gives: { cosmetics: 'pinned_badge' } },
    'nacho_skin_nook':  { cost: 60,  type: 'cosmetic',   name: 'Exclusive Nacho Skin',    gives: { cosmetics: 'nacho_skin_nook' } },
    'raffle_entry':     { cost: 10,  type: 'raffle',     name: 'Sats Raffle Entry',       gives: { raffleEntries: 1 } },
    'streak_freeze_3':  { cost: 12,  type: 'consumable', name: '3× Streak Freezes',      gives: { streakFreezes: 3 } },
    'hint_token_5':     { cost: 12,  type: 'consumable', name: '5× Hint Tokens',         gives: { hintTokens: 5 } },
    'second_rig':       { cost: 25,  type: 'consumable', name: 'Second Mining Rig',       gives: { secondRigCharges: 1 } },
    // Gift Bag — permanent upgrade, increases gift inventory cap from 50 → 75
    'gift_bag':         { cost: 100, type: 'cosmetic',   name: 'Gift Bag',                gives: { cosmetics: 'gift_bag' } },
};

exports.spendTickets = functionsV1.https.onCall(async (data, context) => {
    await secondFactor.requireSecondFactor(secondFactor.stamp(data, context));
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    if (context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functionsV1.https.HttpsError('permission-denied', 'Anonymous users cannot use the shop');
    }

    const uid = context.auth.uid;
    const itemId = (data.itemId || '').replace(/[^a-z0-9_]/g, '').substring(0, 40);
    const quantity = Math.max(1, Math.min(10, parseInt(data.quantity) || 1));

    const item = NOOK_SHOP_ITEMS[itemId];
    if (!item) throw new functionsV1.https.HttpsError('invalid-argument', 'Unknown item: ' + itemId);

    // For bundles (streak_freeze_3, hint_token_5), quantity is always 1 (bundle is the unit)
    const isBundle = ['streak_freeze_3', 'hint_token_5'].includes(itemId);
    const qty = ((item.type === 'consumable' || item.type === 'raffle') && !isBundle) ? quantity : 1;
    const totalCost = item.cost * qty;

    const userRef = db.collection('users').doc(uid);

    const shopResult = await db.runTransaction(async (tx) => {
        const userDoc = await tx.get(userRef);
        if (!userDoc.exists) throw new functionsV1.https.HttpsError('not-found', 'User not found');

        const userData = userDoc.data();
        const currentTickets = userData.orangeTickets || 0;

        if (currentTickets < totalCost) {
            throw new functionsV1.https.HttpsError('failed-precondition',
                `Not enough tickets. Have ${currentTickets}, need ${totalCost}.`);
        }

        // Cosmetics: check not already owned (second_rig is renewable, skip check for it)
        if (item.type === 'cosmetic' && item.gives.cosmetics) {
            const owned = userData.ownedCosmetics || [];
            if (owned.includes(item.gives.cosmetics)) {
                throw new functionsV1.https.HttpsError('already-exists', 'You already own this item.');
            }
        }

        // Build update
        const update = {
            orangeTickets: admin.firestore.FieldValue.increment(-totalCost),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // Apply gives
        const g = item.gives;
        if (g.streakFreezes)  update.streakFreezes  = admin.firestore.FieldValue.increment(g.streakFreezes);
        if (g.hashBoosters)   update.hashBoosters   = admin.firestore.FieldValue.increment(g.hashBoosters * qty);
        if (g.hintTokens)     update.hintTokens     = admin.firestore.FieldValue.increment(g.hintTokens);
        let doubleXpUntil = 0;
        if (itemId === 'double_xp') {
            // Buying starts or extends the window immediately. Leftover charges
            // stay put so an older activateDoubleXP call can still spend them.
            doubleXpUntil = doubleXp.extendUntil(
                doubleXp.untilMillis(userData),
                Date.now(),
                doubleXp.DOUBLE_XP_MS * qty
            );
            update.doubleXpUntil = doubleXpUntil;
            update.doubleXPExpiry = doubleXpUntil;
        } else if (g.doubleXP) {
            update.doubleXPCharges = admin.firestore.FieldValue.increment(g.doubleXP * qty);
        }
        if (g.bonusSpins)        update.bonusSpins        = admin.firestore.FieldValue.increment(g.bonusSpins * qty);
        if (g.raffleEntries)     update.raffleEntries     = admin.firestore.FieldValue.increment(g.raffleEntries * qty);
        const shopPlan = require('./src/badgeProgress').planShopPurchase({ type: item.type, quantity: qty });
        update.shopPurchases = admin.firestore.FieldValue.increment(shopPlan.shopPurchases);
        if (shopPlan.raffleTickets > 0) {
            update.raffleTicketsBought = admin.firestore.FieldValue.increment(shopPlan.raffleTickets);
        }
        if (g.secondRigCharges)  update.secondRigCharges  = admin.firestore.FieldValue.increment(g.secondRigCharges * qty);
        if (g.cosmetics)         update.ownedCosmetics    = admin.firestore.FieldValue.arrayUnion(g.cosmetics);

        tx.update(userRef, update);

        // Community raffle counter (month-scoped)
        if (g.raffleEntries) {
            const monthKey = new Date().toISOString().slice(0,7); // YYYY-MM
            const raffleStatRef = admin.firestore().collection('stats').doc('raffle_' + monthKey);
            tx.set(raffleStatRef, {
                totalEntries: admin.firestore.FieldValue.increment(g.raffleEntries * qty),
                month: monthKey,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }

        // Purchase record (server-only subcollection)
        const purchaseRef = userRef.collection('shop_purchases').doc();
        tx.set(purchaseRef, {
            itemId,
            itemName: item.name,
            quantity: qty,
            cost: totalCost,
            ticketsBefore: currentTickets,
            ticketsAfter: currentTickets - totalCost,
            type: item.type,
            ts: admin.firestore.FieldValue.serverTimestamp(),
        });

        // In-app notification in user's notifications subcollection
        const notifRef = userRef.collection('notifications').doc();
        tx.set(notifRef, {
            type: 'shop_purchase',
            title: '🛒 Purchase Complete',
            body: `You spent ${totalCost} 🎫 on ${item.name}. Balance: ${currentTickets - totalCost} tickets.`,
            read: false,
            ts: admin.firestore.FieldValue.serverTimestamp(),
        });
        try {
            const got = [];
            if (g.streakFreezes) got.push('+' + g.streakFreezes + ' 🧊');
            if (g.hashBoosters) got.push('+' + (g.hashBoosters * qty) + ' hash booster' + (g.hashBoosters * qty === 1 ? '' : 's'));
            if (g.hintTokens) got.push('+' + g.hintTokens + ' hint' + (g.hintTokens === 1 ? '' : 's'));
            if (g.doubleXP) got.push('+' + (g.doubleXP * qty) + ' Double XP');
            if (g.bonusSpins) got.push('+' + (g.bonusSpins * qty) + ' bonus spin' + (g.bonusSpins * qty === 1 ? '' : 's'));
            if (g.raffleEntries) got.push('+' + (g.raffleEntries * qty) + ' raffle ticket' + (g.raffleEntries * qty === 1 ? '' : 's'));
            if (g.secondRigCharges) got.push('+' + (g.secondRigCharges * qty) + ' second rig');
            if (g.cosmetics) got.push('a closet item');
            const gotText = got.length ? ' (' + got.join(', ') + ')' : '';
            rewardNotify.apply(tx, db, admin.firestore.FieldValue.serverTimestamp(), rewardNotify.plan({
                uid: uid,
                onceKey: 'shop_' + Date.now(),
                tickets: -totalCost,
                icon: '🛒',
                message: '-' + totalCost + ' 🎟️: bought ' + item.name + gotText,
            }));
        } catch (notifyErr) {
            console.warn('[SHOP] reward notify skipped:', notifyErr && notifyErr.message);
        }

        // Compute new inventory counts to return to client
        const newInventory = {
            streakFreezes:  (userData.streakFreezes  || 0) + (g.streakFreezes  ? g.streakFreezes        : 0),
            hashBoosters:   (userData.hashBoosters   || 0) + (g.hashBoosters   ? g.hashBoosters * qty   : 0),
            hintTokens:     (userData.hintTokens     || 0) + (g.hintTokens     ? g.hintTokens           : 0),
            doubleXPCharges:(userData.doubleXPCharges|| 0) + (itemId === 'double_xp' ? 0 : (g.doubleXP ? g.doubleXP * qty : 0)),
            bonusSpins:       (userData.bonusSpins       || 0) + (g.bonusSpins       ? g.bonusSpins * qty       : 0),
            raffleEntries:    (userData.raffleEntries    || 0) + (g.raffleEntries    ? g.raffleEntries * qty    : 0),
            secondRigCharges: (userData.secondRigCharges || 0) + (g.secondRigCharges ? g.secondRigCharges * qty : 0),
            ownedCosmetics:   g.cosmetics ? [...(userData.ownedCosmetics || []), g.cosmetics] : (userData.ownedCosmetics || []),
        };

        return {
            success: true,
            newTickets: currentTickets - totalCost,
            itemId,
            quantity: qty,
            itemName: item.name,
            inventory: newInventory,
            doubleXpUntil: doubleXpUntil,
            minutesLeft: doubleXp.minutesLeft(doubleXpUntil, Date.now()),
        };
    });
    try {
        const shopIds = familyFor('shopPurchases').slice();
        if (item.type === 'raffle') shopIds.push.apply(shopIds, familyFor('raffleTicketsBought'));
        await require('./src/badgeCredit').grantIds(db, admin, uid, shopIds);
    } catch (e) { console.warn('[SHOP] badges', e.message); }
    return shopResult;
});

exports.convertPointsToTickets = functionsV1.https.onCall(async (data, context) => {
    await secondFactor.requireSecondFactor(secondFactor.stamp(data, context));
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    if (context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functionsV1.https.HttpsError('permission-denied', 'Anonymous users cannot convert XP');
    }

    const uid = context.auth.uid;
    const tickets = Math.max(1, Math.min(10, parseInt(data.tickets) || 1));

    const POINTS_PER_TICKET = 500;
    const MAX_PER_DAY = 10;
    const today = new Date().toISOString().split('T')[0];

    const userRef = db.collection('users').doc(uid);
    const dailyRef = userRef.collection('daily_action_counts').doc(`${today}_pts_to_tickets`);

    return db.runTransaction(async (tx) => {
        const [userDoc, dailyDoc] = await Promise.all([tx.get(userRef), tx.get(dailyRef)]);
        if (!userDoc.exists) throw new functionsV1.https.HttpsError('not-found', 'User not found');

        const userData = userDoc.data();
        const todayCount = dailyDoc.exists ? (dailyDoc.data().count || 0) : 0;

        if (todayCount + tickets > MAX_PER_DAY) {
            throw new functionsV1.https.HttpsError('resource-exhausted',
                `Daily limit: ${MAX_PER_DAY} tickets/day. Already converted ${todayCount} today.`);
        }

        const pointsCost = tickets * POINTS_PER_TICKET;
        const currentPoints = userData.points || 0;
        const _ptsClaimed = userData.pointsClaimed || 0;
        const _ptsDonated = userData.pointsDonated || 0;
        const _ptsExchanged = userData.pointsExchanged || 0;
        // Available = total earned minus all three spend paths (sats claim, donation, ticket exchange).
        // points (total earned) is NEVER decremented — only offset counters change.
        const availableForExchange = currentPoints - _ptsClaimed - _ptsDonated - _ptsExchanged;

        if (availableForExchange < pointsCost) {
            throw new functionsV1.https.HttpsError('failed-precondition',
                `Need ${pointsCost.toLocaleString()} XP available, but only ${Math.max(0, availableForExchange).toLocaleString()} is available (total earned: ${currentPoints.toLocaleString()}).`);
        }

        tx.update(userRef, {
            // DO NOT decrement `points` — it is total XP earned and drives the leaderboard.
            // Track the exchange as an offset counter instead, matching pointsClaimed / pointsDonated.
            pointsExchanged: admin.firestore.FieldValue.increment(pointsCost),
            orangeTickets: admin.firestore.FieldValue.increment(tickets),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Dedup counter
        tx.set(dailyRef, { count: admin.firestore.FieldValue.increment(tickets), date: today }, { merge: true });

        // Purchase record
        const purchaseRef = userRef.collection('shop_purchases').doc();
        tx.set(purchaseRef, {
            itemId: 'pts_to_tickets',
            itemName: `${tickets} Orange Ticket${tickets > 1 ? 's' : ''} (XP Exchange)`,
            quantity: tickets,
            cost: pointsCost,
            costType: 'points',
            type: 'exchange',
            todayCountAfter: todayCount + tickets,
            ts: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Notification
        const notifRef = userRef.collection('notifications').doc();
        tx.set(notifRef, {
            type: 'shop_exchange',
            title: '💱 XP Exchanged',
            body: `Converted ${pointsCost.toLocaleString()} XP → ${tickets} 🎫 ticket${tickets > 1 ? 's' : ''}. (${MAX_PER_DAY - todayCount - tickets} exchanges left today)`,
            read: false,
            ts: admin.firestore.FieldValue.serverTimestamp(),
        });
        try {
            rewardNotify.apply(tx, db, admin.firestore.FieldValue.serverTimestamp(), rewardNotify.plan({
                uid: uid,
                onceKey: 'xptix_' + Date.now(),
                tickets: tickets,
                icon: '💱',
                message: '+' + tickets + ' 🎟️ from exchanging ' + pointsCost.toLocaleString('en-US') + ' XP',
            }));
        } catch (notifyErr) {
            console.warn('[EXCHANGE] reward notify skipped:', notifyErr && notifyErr.message);
        }

        return {
            success: true,
            newPoints: currentPoints - pointsCost,
            newTickets: (userData.orangeTickets || 0) + tickets,
            todayUsed: todayCount + tickets,
            remaining: MAX_PER_DAY - todayCount - tickets,
        };
    });
});

exports.activateHashBooster = functionsV1.https.onCall(async (data, context) => {
    await secondFactor.requireSecondFactor(secondFactor.stamp(data, context));
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    if (context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functionsV1.https.HttpsError('permission-denied', 'Anonymous users cannot activate boosters');
    }

    const uid = context.auth.uid;
    const userRef = db.collection('users').doc(uid);

    return db.runTransaction(async (tx) => {
        const userDoc = await tx.get(userRef);
        if (!userDoc.exists) throw new functionsV1.https.HttpsError('not-found', 'User not found');

        const userData = userDoc.data();
        const hashBoosters = userData.hashBoosters || 0;

        if (hashBoosters < 1) {
            throw new functionsV1.https.HttpsError('failed-precondition', 'No hash boosters available.');
        }

        // Grant +100 bonus hashes (added to hashBoosterHashes budget)
        // These bypass the cooldown entirely — user can hash 100x with no rate limit.
        // Once exhausted, normal cooldown resumes.
        tx.update(userRef, {
            hashBoosters: admin.firestore.FieldValue.increment(-1),
            hashBoosterHashes: admin.firestore.FieldValue.increment(100),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        try {
            rewardNotify.apply(tx, db, admin.firestore.FieldValue.serverTimestamp(), rewardNotify.plan({
                uid: uid,
                onceKey: 'booster_' + Date.now(),
                icon: '⚡',
                message: '-1 hash booster: +100 bonus hashes ready',
            }));
        } catch (notifyErr) {
            console.warn('[BOOST] reward notify skipped:', notifyErr && notifyErr.message);
        }

        return {
            success: true,
            hashBoosterHashes: (userData.hashBoosterHashes || 0) + 100,
            hashBoosters: hashBoosters - 1,
        };
    });
});

exports.useHintToken = functionsV1.https.onCall(async (data, context) => {
    await secondFactor.requireSecondFactor(secondFactor.stamp(data, context));
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    if (context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functionsV1.https.HttpsError('permission-denied', 'Anonymous users cannot use hint tokens');
    }

    const uid = context.auth.uid;
    const userRef = db.collection('users').doc(uid);

    return db.runTransaction(async (tx) => {
        const userDoc = await tx.get(userRef);
        if (!userDoc.exists) throw new functionsV1.https.HttpsError('not-found', 'User not found');

        const userData = userDoc.data();
        const hintTokens = userData.hintTokens || 0;

        if (hintTokens < 1) {
            throw new functionsV1.https.HttpsError('failed-precondition', 'No hint tokens available.');
        }

        tx.update(userRef, {
            hintTokens: admin.firestore.FieldValue.increment(-1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        try {
            rewardNotify.apply(tx, db, admin.firestore.FieldValue.serverTimestamp(), rewardNotify.plan({
                uid: uid,
                onceKey: 'hint_' + Date.now(),
                icon: '💡',
                message: '-1 hint: used a hint token',
            }));
        } catch (notifyErr) {
            console.warn('[HINT] reward notify skipped:', notifyErr && notifyErr.message);
        }

        return { success: true, hintTokens: hintTokens - 1 };
    });
});

exports.activateDoubleXP = functionsV1.https.onCall(async (data, context) => {
    await secondFactor.requireSecondFactor(secondFactor.stamp(data, context));
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    if (context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functionsV1.https.HttpsError('permission-denied', 'Anonymous users cannot activate Double XP');
    }

    const uid = context.auth.uid;
    const userRef = db.collection('users').doc(uid);

    return db.runTransaction(async (tx) => {
        const userDoc = await tx.get(userRef);
        if (!userDoc.exists) throw new functionsV1.https.HttpsError('not-found', 'User not found');

        const userData = userDoc.data();
        const charges = userData.doubleXPCharges || 0;

        if (charges < 1) {
            throw new functionsV1.https.HttpsError('failed-precondition', 'No Double XP charges available.');
        }

        // Leftover charges from before the purchase started the timer.
        // Extend the same way a new purchase does, and store a number so the
        // client countdown can compare it to Date.now() across reloads.
        const nowMs = Date.now();
        const alreadyActive = doubleXp.isActive(userData, nowMs);
        const until = doubleXp.extendUntil(doubleXp.untilMillis(userData), nowMs, doubleXp.DOUBLE_XP_MS);

        tx.update(userRef, {
            doubleXPCharges: admin.firestore.FieldValue.increment(-1),
            doubleXpUntil: until,
            doubleXPExpiry: until,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        try {
            rewardNotify.apply(tx, db, admin.firestore.FieldValue.serverTimestamp(), rewardNotify.plan({
                uid: uid,
                onceKey: 'doublexp_' + Date.now(),
                icon: '✨',
                message: '-1 Double XP charge: activated for 60 minutes',
            }));
        } catch (notifyErr) {
            console.warn('[2XP] reward notify skipped:', notifyErr && notifyErr.message);
        }

        return {
            success: true,
            doubleXPExpiry: until,
            doubleXpUntil: until,
            charges: charges - 1,
            extended: alreadyActive,
            minutesLeft: doubleXp.minutesLeft(until, nowMs),
        };
    });
});

exports.useBonusSpin = functionsV1.https.onCall(async (data, context) => {
    await secondFactor.requireSecondFactor(secondFactor.stamp(data, context));
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    if (context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functionsV1.https.HttpsError('permission-denied', 'Anonymous users cannot use bonus spins');
    }

    const uid = context.auth.uid;
    const userRef = db.collection('users').doc(uid);

    return db.runTransaction(async (tx) => {
        const userDoc = await tx.get(userRef);
        if (!userDoc.exists) throw new functionsV1.https.HttpsError('not-found', 'User not found');

        const userData = userDoc.data();
        const bonusSpins = userData.bonusSpins || 0;

        if (bonusSpins < 1) {
            throw new functionsV1.https.HttpsError('failed-precondition', 'No bonus spins available.');
        }

        // Set server-side flag so dailySpin bypasses the already-spun check for this spin
        tx.update(userRef, {
            bonusSpins: admin.firestore.FieldValue.increment(-1),
            bonusSpinGranted: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        try {
            rewardNotify.apply(tx, db, admin.firestore.FieldValue.serverTimestamp(), rewardNotify.plan({
                uid: uid,
                onceKey: 'bonusspin_' + Date.now(),
                icon: '🎡',
                message: '-1 bonus spin: spin unlocked',
            }));
        } catch (notifyErr) {
            console.warn('[SPIN] reward notify skipped:', notifyErr && notifyErr.message);
        }

        return { success: true, bonusSpins: bonusSpins - 1 };
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// HOT TOPICS — Weekly Bitcoin trending topics aggregator
// Runs every Sunday at 22:00 America/New_York (= Monday 02:00–03:00 UTC)
// Sources: X API v2 recent search, Reddit RSS, Stacker News, BitcoinTalk, Brave web search
// AI: Cloudflare Workers AI Llama 4 Scout with JSON mode, repair, and retries
// Stores result in Firestore: hotTopics/latest
// ─────────────────────────────────────────────────────────────────────────────

const { onSchedule: onScheduleV2 } = require('firebase-functions/v2/scheduler');
const hotTopics = require('./src/hotTopics');

async function _pushHotTopics(result) {
    if (!result || !result.saved || !result.topics || !result.topics.length) return;
    const headline = result.topics[0].title || 'This week\'s Bitcoin topics are in.';
    try {
        await broadcastCategory('news', async function () {
            return {
                title: 'Hot Topics',
                body: headline,
                url: 'https://bitcoineducation.quest/'
            };
        });
    } catch (e) {
        console.warn('[HotTopics] push failed', e.message);
    }
}

// Trigger: Sunday 10 PM Eastern (America/New_York handles DST automatically).
// Deploying this function updates the Cloud Scheduler job to the new cron.
// The quality gate still rejects template topics.
exports.refreshHotTopics = onScheduleV2({
    schedule: '0 22 * * 0',
    timeZone: 'America/New_York',
    // Workers AI uses 3 attempts at 45s (~136s) plus source fetches. That fits
    // in 540s, so this timeout stays put.
    timeoutSeconds: 540,
    memory: '512MiB',
}, async () => {
    console.log('[HotTopics] Starting weekly refresh...');
    try {
        const hotResult = await hotTopics.runHotTopicsJob({
            mode: 'schedule',
            env: process.env,
            db: db,
            admin: admin,
            listAdminUids: _listAdminClaimUids,
        });
        await _pushHotTopics(hotResult);
    } catch (err) {
        console.error('[HotTopics] Fatal error:', err);
    }
});

// Also expose as HTTP endpoint so you can trigger it manually
// GET https://us-central1-bitcoin-education-archive.cloudfunctions.net/refreshHotTopicsHttp
// Header: x-admin-token: $ADMIN_TOKEN
// Gen1 HTTPS functions default to 60s. Three 45s Workers AI attempts need
// longer than that, so this matches the scheduler's 540s ceiling.
exports.refreshHotTopicsHttp = functionsV1.runWith({
    timeoutSeconds: 540,
}).https.onRequest(async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        const result = await hotTopics.runHotTopicsJob({
            mode: 'http',
            env: process.env,
            db: db,
            admin: admin,
            listAdminUids: _listAdminClaimUids,
        });
        await _pushHotTopics(result);
        res.json({
            ok: true,
            topicsCount: result.topics.length,
            saved: result.saved,
            sources: result.sourceReport,
            topics: result.topics,
        });
    } catch (err) {
        console.error('[HotTopics] HTTP trigger error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Manual force-refresh that bypasses the quality gate (admin use only)
exports.refreshHotTopicsForce = functionsV1.runWith({
    timeoutSeconds: 540,
}).https.onRequest(async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        const result = await hotTopics.runHotTopicsJob({
            mode: 'force',
            env: process.env,
            db: db,
            admin: admin,
            listAdminUids: _listAdminClaimUids,
        });
        await _pushHotTopics(result);
        res.json({
            ok: true,
            topicsCount: result.topics.length,
            qualityGatePassed: result.qualityGatePassed,
            saved: result.saved,
            sources: result.sourceReport,
            topics: result.topics,
        });
    } catch (err) {
        console.error('[HotTopics] Force refresh error:', err);
        res.status(500).json({ error: err.message });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// END HOT TOPICS
// ─────────────────────────────────────────────────────────────────────────────

// ── Satoshi's Favor → X auto-post ────────────────────────────────────────────
const { tweetSatoshisFavor } = require('./src/tweetSatoshisFavor');
exports.tweetSatoshisFavor = tweetSatoshisFavor;

// ── GIF Search Proxy (Tenor v2) ───────────────────────────────────────────────
// Proxies Tenor v2 requests server-side so the API key never leaks to the client
// and no browser-side API activation is required.
exports.searchGifs = functionsV1.https.onCall(async (data, context) => {
    // [SECURITY FIX] Require authenticated non-anonymous user — prevents Giphy quota drain
    // by unauthenticated callers (AppCheck alone doesn't guarantee a real signed-in user).
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    if (context.auth.token.firebase && context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functionsV1.https.HttpsError('permission-denied', 'Sign in required');
    }
    const query = (data.query || '').trim().slice(0, 100);
    const limit = Math.min(Math.max(parseInt(data.limit) || 20, 1), 50);
    if (!query) return { results: [] };

    // Giphy API (replaces discontinued Tenor v1 / blocked Tenor v2 key)
    const GIPHY_KEY = (functions.config().giphy && functions.config().giphy.api_key) || process.env.GIPHY_API_KEY || '';
    const url = 'https://api.giphy.com/v1/gifs/search'
        + '?api_key=' + GIPHY_KEY
        + '&q=' + encodeURIComponent(query)
        + '&limit=' + limit
        + '&rating=pg-13'
        + '&lang=en';

    try {
        const resp = await fetch(url);
        const json = await resp.json();
        if (!json.data || !Array.isArray(json.data)) return { results: [] };
        // Map Giphy response to same {thumb, full} shape the client expects
        const results = json.data.map(function(gif) {
            const images = gif.images || {};
            const thumb = (images.fixed_height_small && images.fixed_height_small.url)
                       || (images.fixed_height && images.fixed_height.url)
                       || '';
            const full  = (images.original && images.original.url)
                       || (images.fixed_height && images.fixed_height.url)
                       || thumb;
            return { thumb, full };
        }).filter(function(r) { return r.thumb; });
        return { results };
    } catch (e) {
        console.error('[searchGifs]', e.message);
        throw new functionsV1.https.HttpsError('internal', 'GIF search failed');
    }
});

// ===== WEEKLY RAID BOSS ANNOUNCEMENT =====
// Fires Sunday 7 PM ET (11 PM UTC / 23:00 UTC)
// Posts a boss status update to global_chat (visible to all users)
// with a deep link to the Quest Hub Raid section
exports.raidBossWeeklyAnnouncement = onSchedule(
  { schedule: '0 23 * * 0', timeZone: 'UTC', region: 'us-central1' },
  async (event) => {
    const now = admin.firestore.Timestamp.now();
    const nowMs = now.toDate().getTime();

    // Find active boss
    const bossQuery = await db.collection('raid_bosses')
      .orderBy('startTime', 'desc')
      .limit(5)
      .get();

    let activeBoss = null;
    bossQuery.forEach((doc) => {
      if (activeBoss) return;
      const d = doc.data();
      if (d.defeated || d.placeholder) return;
      const startMs = d.startTime ? d.startTime.toDate().getTime() : 0;
      const endMs = d.endTime ? d.endTime.toDate().getTime() : 0;
      if (startMs <= nowMs && endMs > nowMs) {
        activeBoss = d;
      }
    });

    if (!activeBoss) {
      console.log('[RAID ANNOUNCE] No active boss found — skipping announcement.');
      return null;
    }

    const current = activeBoss.current || 0;
    const target = activeBoss.target || 0;
    const name = activeBoss.name || 'Raid Boss';
    const pct = target > 0 ? Math.round((current / target) * 100) : 0;
    const hp = Math.max(0, target - current);
    const defeated = activeBoss.defeated || false;

    const hpPct = target > 0 ? Math.round((hp / target) * 100) : 0;
    let text;
    if (defeated) {
      text = `⚔️ BOSS DEFEATED! The community took down **${name}** — amazing work everyone! 🏆 Check the [Quest Hub → Raid](#questhub) for results.`;
    } else if (pct === 0) {
      text = `⚔️ **${name}** is waiting! Boss has ${hp}/${target} HP remaining — we haven't dealt any damage yet. Every action counts! 👉 [Quest Hub → Raid](#questhub)`;
    } else if (pct >= 75) {
      text = `⚔️ ALMOST THERE! **${name}** has only ${hpPct}% health remaining — only ${hp} HP left! Push through and claim the community prize! 🔥👉 [Quest Hub → Raid](#questhub)`;
    } else if (pct >= 50) {
      text = `⚔️ Halfway there! **${name}** is at ${hpPct}% health remaining (${hp} HP left). Keep it up! 💪 [Quest Hub → Raid](#questhub)`;
    } else {
      text = `⚔️ Weekly Raid Update: **${name}** — ${hpPct}% health remaining (${hp}/${target} HP). Deal more damage — [Quest Hub → Raid](#questhub) 🗡️`;
    }

    await db.collection('global_chat').add({
      uid: 'nacho-bot',
      name: '🦌 Nacho',
      text: text,
      isNachoAuto: false,
      ts: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[RAID ANNOUNCE] Posted to global_chat: "${text}"`);
    return null;
  }
);

// One Nacho global_chat doc per shout, then the same Telegram mirror other
// Nacho shoutouts use. A repeat call sees the doc and does not post again.
async function postNachoPvpMessage(plan) {
    if (!plan || !plan.docId || !plan.text) return;
    const ref = db.collection('global_chat').doc(plan.docId);
    const existing = await ref.get();
    if (existing.exists) {
        await mirrorShoutoutOnce({ db: db, docId: plan.docId, collection: 'global_chat', text: plan.text });
        return;
    }
    await ref.set({
        uid: 'nacho-bot',
        name: '🦌 Nacho',
        text: String(plan.text).slice(0, 500),
        isNachoAuto: false,
        mentionUid: String(plan.mentionUid || ''),
        ts: admin.firestore.FieldValue.serverTimestamp(),
        pvpShout: true,
    });
    await mirrorShoutoutOnce({ db: db, docId: plan.docId, collection: 'global_chat', text: plan.text });
}

async function pvpAccountFlags(uid) {
    const [userSnap, ledgerSnap] = await Promise.all([
        db.collection('users').doc(uid).get(),
        db.collection('faucet_ledger').doc(uid).get(),
    ]);
    const ban = faucetGuard.assessBan(
        userSnap.exists ? userSnap.data() : {},
        ledgerSnap.exists ? ledgerSnap.data() : {}
    );
    let anonymous = true;
    try {
        const authUser = await admin.auth().getUser(uid);
        const providers = authUser.providerData || [];
        anonymous = !authUser.email && providers.length === 0;
    } catch (e) { anonymous = true; }
    return {
        banned: ban.ok !== true,
        anonymous: anonymous,
        username: userSnap.exists ? userSnap.data().username : '',
        pushEnabled: userSnap.exists && userSnap.data().pushEnabled === true,
        pvpAlertsMuted: userSnap.exists && userSnap.data().pvpAlertsMuted === true,
    };
}

// Grant match XP, W/L, and one win ticket from the server-owned player uids.
// pvp_rewards/{matchId} is the claim lock, so a replay cannot mint a second ticket.
async function settlePvpMatch(matchId, after) {
    if (!after || (after.status !== 'finished' && after.status !== 'forfeit')) return;
    if (after.rewardsGranted === true) return;
    const keySnap = await db.collection('pvp_answer_keys').doc(matchId).get();
    const keyData = keySnap.exists ? keySnap.data() : {};
    const ids = keyData.playerUids || null;
    if (!ids || !ids.player1 || !ids.player2) return;
    const p1 = after.player1 || {};
    const p2 = after.player2 || {};
    const [f1, f2] = await Promise.all([pvpAccountFlags(ids.player1), pvpAccountFlags(ids.player2)]);
    const plan = pvpFlow.planPvpReward({
        matchId: matchId,
        status: after.status,
        alreadyGranted: false,
        forfeitedBy: after.forfeitedBy || '',
        forfeitReason: after.forfeitReason || '',
        player1: {
            uid: ids.player1,
            name: keyData.player1Name || '',
            score: p1.score || 0,
            roundWins: pvpFlow.countWins(p1.answers),
            banned: f1.banned, anonymous: f1.anonymous,
        },
        player2: {
            uid: ids.player2,
            name: keyData.player2Name || '',
            score: p2.score || 0,
            roundWins: pvpFlow.countWins(p2.answers),
            banned: f2.banned, anonymous: f2.anonymous,
        },
    });
    if (!plan.grant) {
        if (plan.reason === 'disconnect') {
            await db.collection('pvp_matches').doc(matchId).set({ rewardsGranted: true, rewards: {} }, { merge: true });
        }
        return;
    }
    const rewardRef = db.collection('pvp_rewards').doc(plan.claimId);
    const offsetToday = getOffsetDateKey();
    const wrote = await db.runTransaction(async (tx) => {
        const existing = await tx.get(rewardRef);
        if (existing.exists) return false;
        const userRefs = plan.players.map(function (p) { return db.collection('users').doc(p.uid); });
        const dailyRefs = plan.players.map(function (p) {
            return db.collection('users').doc(p.uid).collection('daily_points').doc(offsetToday);
        });
        const ticketRefs = plan.players.map(function (p) {
            return db.collection('users').doc(p.uid).collection('daily_action_counts').doc(offsetToday + '_pvp_win_ticket');
        });
        const userSnaps = [];
        const dailySnaps = [];
        const ticketSnaps = [];
        const ledgerSnaps = [];
        for (let i = 0; i < userRefs.length; i++) {
            userSnaps.push(await tx.get(userRefs[i]));
            dailySnaps.push(await tx.get(dailyRefs[i]));
            ticketSnaps.push(await tx.get(ticketRefs[i]));
            ledgerSnaps.push(await tx.get(db.collection('faucet_ledger').doc(plan.players[i].uid)));
        }
        const applied = [];
        for (let i = 0; i < plan.players.length; i++) {
            const p = plan.players[i];
            if (!userSnaps[i].exists) {
                applied.push({ uid: p.uid, points: 0, overflowAdded: 0, tickets: 0, outcome: p.outcome });
                continue;
            }
            const used = dailySnaps[i].exists ? (dailySnaps[i].data().total || 0) : 0;
            const pvpUser = userSnaps[i].data() || {};
            const pvpLedger = ledgerSnaps[i].exists ? (ledgerSnaps[i].data() || {}) : {};
            const pvpBlocked = !!(pvpUser.ban_reason) || pvpUser.banned === true || pvpUser.satsDisabled === true || pvpLedger.banned === true;
            const grant = awardActions.planGrant({
                xp: pvpBlocked ? 0 : p.points,
                dailyUsed: used,
                dailyCap: awardActions.DAILY_CAP,
            });
            const write = pvpFlow.planXpWrite(grant.awarded);
            const ticket = pvpFlow.planWinTicket(Object.assign({}, p, {
                ticketClaimedToday: ticketSnaps[i].exists,
            }));
            const upd = {};
            if (write.write) {
                upd.points = admin.firestore.FieldValue.increment(write.points);
                upd.weeklyXP = admin.firestore.FieldValue.increment(write.weeklyXP);
                upd.monthlyXP = admin.firestore.FieldValue.increment(write.monthlyXP);
            }
            if (p.pvpWins) upd.pvpWins = admin.firestore.FieldValue.increment(p.pvpWins);
            if (p.pvpLosses) upd.pvpLosses = admin.firestore.FieldValue.increment(p.pvpLosses);
            if (ticket.tickets > 0) upd.orangeTickets = admin.firestore.FieldValue.increment(ticket.tickets);
            if (Object.keys(upd).length) tx.update(userRefs[i], upd);
            if (write.write) {
                tx.set(dailyRefs[i], { total: admin.firestore.FieldValue.increment(write.points) }, { merge: true });
            }
            if (ticket.tickets > 0) {
                tx.set(ticketRefs[i], {
                    awardedAt: admin.firestore.FieldValue.serverTimestamp(),
                    action: 'pvp_win_ticket',
                });
            }
            applied.push({
                uid: p.uid,
                points: write.points,
                weeklyXP: write.weeklyXP,
                monthlyXP: write.monthlyXP,
                overflowAdded: write.overflowAdded,
                pendingOverflow: userSnaps[i].data().pendingOverflow || 0,
                tickets: ticket.tickets,
                outcome: p.outcome,
            });
        }
        const rewardsMap = {};
        applied.forEach(function (a) {
            rewardsMap[a.uid] = { points: a.points, outcome: a.outcome, tickets: a.tickets };
        });
        tx.set(rewardRef, {
            matchId: matchId,
            reason: plan.reason,
            applied: applied,
            at: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.set(db.collection('pvp_matches').doc(matchId), {
            rewardsGranted: true,
            rewards: rewardsMap,
        }, { merge: true });
        return true;
    });
    if (wrote && plan.shout && plan.shout.post) {
        try { await postNachoPvpMessage(plan.shout); }
        catch (e) { console.warn('[pvp] result shout failed'); }
    }
}

const { createLobbyPush } = require('./src/pvpLobbyPush');
const lobbyPush = createLobbyPush({ db: db, pvpFlow: pvpFlow, sendUserPush: sendUserPush });

async function pushPvpLobby(joinerUid, name) {
    return lobbyPush.pushPvpLobby(joinerUid, name);
}

async function syncPvpLobbyLive(docId, before, after) {
    const now = Date.now();
    const liveRef = db.collection('pvp_lobby_live').doc('current');
    if (before && after) {
        const peek = await liveRef.get();
        const row = peek.exists && peek.data().entries ? peek.data().entries[docId] : null;
        if (pvpFlow.shouldSkipLobbySummary(before, after, row, now)) return;
    }
    const becameWaiting = !!(after && after.status === 'waiting' && (!before || before.status !== 'waiting'));
    let trustedName = '';
    let blocked = false;
    if (becameWaiting) {
        const flags = await pvpAccountFlags(docId);
        const username = String(flags.username || '').trim();
        trustedName = username ? pvpFlow.safeDisplayName(username) : '';
        blocked = flags.banned || flags.anonymous || !username || trustedName === 'a Bitcoiner';
    }
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(liveRef);
        const entries = (snap.exists && snap.data().entries) || {};
        let row = after;
        if (after && after.status === 'waiting') {
            const keptRow = entries[docId];
            const kept = keptRow && keptRow.name;
            if (becameWaiting && !blocked) {
                row = Object.assign({}, after, { name: trustedName, uid: docId });
            } else if (!becameWaiting && kept) {
                row = Object.assign({}, after, { name: kept, uid: keptRow.uid || docId });
            } else {
                row = Object.assign({}, after, { status: 'blocked' });
            }
        }
        const next = pvpFlow.mergeLobbyEntry(entries, docId, row, now);
        tx.set(liveRef, {
            entries: next,
            count: Object.keys(next).length,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
    if (!becameWaiting || blocked) return;
    const rateRef = db.collection('pvp_rate').doc(docId);
    const globalRef = db.collection('pvp_rate').doc('global');
    const chatDecision = pvpFlow.shouldPostLobbyShout({
        uid: docId,
        username: trustedName,
        nowMs: now,
        lastPostMs: null,
        banned: false,
        anonymous: false,
        globalCap: false,
    });
    if (!chatDecision.post) return;
    const chatRef = db.collection('global_chat').doc(chatDecision.docId);
    const posted = await db.runTransaction(async (tx) => {
        const rate = await tx.get(rateRef);
        const global = await tx.get(globalRef);
        const chat = await tx.get(chatRef);
        const room = pvpFlow.lobbyGlobalRoom(global.exists ? global.data() : {}, Date.now());
        const again = pvpFlow.shouldPostLobbyShout({
            uid: docId,
            username: trustedName,
            nowMs: Date.now(),
            lastPostMs: rate.exists ? rate.data().lastLobbyShoutMs : null,
            banned: false,
            anonymous: false,
            globalCap: !room.shout,
        });
        if (!again.post || chat.exists) return null;
        tx.set(rateRef, { lastLobbyShoutMs: Date.now() }, { merge: true });
        tx.set(globalRef, {
            windowStart: room.windowStart,
            shoutCount: room.shoutCount + 1,
            pushCount: room.pushCount,
        }, { merge: true });
        tx.set(chatRef, {
            uid: 'nacho-bot',
            name: '🦌 Nacho',
            text: again.text,
            isNachoAuto: false,
            mentionUid: docId,
            ts: admin.firestore.FieldValue.serverTimestamp(),
            pvpShout: true,
        });
        return again;
    });
    if (!posted) return;
    try {
        await mirrorShoutoutOnce({ db: db, docId: posted.docId, collection: 'global_chat', text: posted.text });
    } catch (e) { console.warn('[pvp] telegram mirror failed'); }
    try { await pushPvpLobby(docId, trustedName); }
    catch (e) { console.warn('[pvp] push failed'); }
}

// Maintains the one summary doc clients listen to, and posts Nacho's lobby line.
exports.onPvpLobbyLive = onDocumentWritten('pvp_lobby/{docId}', async (event) => {
    const before = event.data.before.exists ? event.data.before.data() : null;
    const after = event.data.after.exists ? event.data.after.data() : null;
    try {
        await syncPvpLobbyLive(event.params.docId, before, after);
    } catch (e) {
        console.error('[pvp lobby]', e && e.message ? e.message : e);
    }
    return null;
});

async function pvpHousekeepMatches(now) {
    const countdown = await db.collection('pvp_matches').where('status', '==', 'countdown').limit(15).get();
    for (const doc of countdown.docs) {
        const created = pvpFlow.lastSeenMs(doc.data().createdAt);
        if (created && (now - created) > 20000) {
            await doc.ref.update({
                status: 'active',
                currentQ: doc.data().currentQ || 0,
                questionStartedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    }
    const active = await db.collection('pvp_matches').where('status', '==', 'active').limit(15).get();
    for (const doc of active.docs) {
        const d = doc.data();
        const started = pvpFlow.lastSeenMs(d.questionStartedAt);
        if (!started || (now - started) < 20000) continue;
        const q = d.currentQ || 0;
        const a1 = (d.player1 && d.player1.answers) || [];
        const a2 = (d.player2 && d.player2.answers) || [];
        const p1missing = a1.length <= q;
        const p2missing = a2.length <= q;
        if (p1missing && p2missing && (now - started) > 90000) {
            await doc.ref.update({ status: 'forfeit', forfeitedBy: '', forfeitReason: 'disconnect' });
            continue;
        }
        if (p1missing === p2missing) continue;
        const key = p1missing ? 'player1' : 'player2';
        const answers = (p1missing ? a1 : a2).slice();
        answers.push({ selected: -1, answeredAt: new Date().toISOString() });
        const update = {};
        update[key + '.answers'] = answers;
        await doc.ref.update(update);
    }
    const results = await db.collection('pvp_matches').where('status', '==', 'question_result').limit(15).get();
    for (const doc of results.docs) {
        const d = doc.data();
        const resolved = typeof d.resolvedAt === 'number' ? d.resolvedAt : 0;
        if (!resolved || (now - resolved) < 20000) continue;
        const p1w = pvpFlow.countWins(d.player1 && d.player1.answers);
        const p2w = pvpFlow.countWins(d.player2 && d.player2.answers);
        if (d.questionWinner === 'reroll') {
            await doc.ref.update({
                status: 'active',
                questionWinner: null,
                questionStartedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        } else if ((d.currentQ || 0) + 1 >= 5 || pvpFlow.matchShouldFinish(p1w, p2w)) {
            await doc.ref.update({ status: 'finished' });
        } else {
            await doc.ref.update({
                status: 'active',
                currentQ: (d.currentQ || 0) + 1,
                questionWinner: null,
                questionStartedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    }
}

// ===== PVP LOBBY CLEANUP =====
// Every 5 minutes. Drops lobby docs with no heartbeat in 45s and rewrites the
// single pvp_lobby_live summary. Also unsticks countdown / unanswered rounds.
exports.cleanupExpiredLobbies = onSchedule({ schedule: 'every 5 minutes', timeZone: 'UTC' }, async () => {
    const now = Date.now();
    try {
        const snap = await db.collection('pvp_lobby').limit(200).get();
        const liveSnap = await db.collection('pvp_lobby_live').doc('current').get();
        const trusted = (liveSnap.exists && liveSnap.data().entries) || {};
        const entries = {};
        let batch = db.batch();
        let ops = 0;
        let deleted = 0;
        for (const doc of snap.docs) {
            const d = doc.data() || {};
            const seen = pvpFlow.lastSeenMs(d.lastSeen);
            const alive = d.status === 'waiting' && seen && (now - seen) < pvpFlow.LOBBY_STALE_MS;
            if (!alive) {
                batch.delete(doc.ref);
                ops++;
                deleted++;
                if (ops >= 400) {
                    await batch.commit();
                    batch = db.batch();
                    ops = 0;
                }
                continue;
            }
            const flags = await pvpAccountFlags(doc.id);
            const kept = pvpFlow.trustedLobbyKeep(
                trusted[doc.id], d, now, flags.banned || flags.anonymous, doc.id
            );
            if (kept) entries[doc.id] = kept;
        }
        batch.set(db.collection('pvp_lobby_live').doc('current'), {
            entries: entries,
            count: Object.keys(entries).length,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await batch.commit();
        console.log('[PVP CLEANUP] Deleted', deleted, 'stale lobby docs');
        await pvpHousekeepMatches(now);
    } catch (e) {
        console.error('[PVP CLEANUP] Error:', e.message);
    }
    try {
        await sweepExpiredMfaRows(db, new Date());
    } catch (e) {
        console.error('[MFA CLEANUP] Error:', e.message);
    }
    try {
        const { deleteExpiredRateRows } = require('./src/rateLimitSalt');
        const swept = await deleteExpiredRateRows(db, Date.now(), {
            documentIdField: admin.firestore.FieldPath.documentId(),
        });
        if (swept.rateLimits || swept.salts || swept.legacy) {
            console.log('[RATE CLEANUP] Deleted', swept.rateLimits, 'expired limits,', swept.salts, 'salts,', swept.legacy, 'legacy address rows');
        }
    } catch (e) {
        console.error('[RATE CLEANUP] Error:', e.message);
    }
    return null;
});

// ===== COUNTRY STATS AGGREGATION =====
// Fires when a user document is written. If country changed, updates stats/countries
// with atomic increments so the world map always has fresh data.
exports.updateCountryStats = onDocumentWritten('users/{uid}', async (event) => {
    const change = { before: event.data.before, after: event.data.after }; const context = { params: event.params };
        const before = change.before.exists ? change.before.data() : {};
        const after  = change.after.exists  ? change.after.data()  : {};

        const prevCountry = (before.country || '').trim();
        const newCountry  = (after.country  || '').trim();

        // No change to country field — skip
        if (prevCountry === newCountry) return null;

        const statsRef = db.collection('stats').doc('countries');
        const updates  = {};

        if (prevCountry) {
            updates['counts.' + prevCountry] = admin.firestore.FieldValue.increment(-1);
        }
        if (newCountry) {
            updates['counts.' + newCountry] = admin.firestore.FieldValue.increment(1);
            // Stamp firstSeen only if this country has never appeared before
            try {
                const snap = await statsRef.get();
                const existing = snap.exists ? (snap.data().firstSeen || {}) : {};
                if (!existing[newCountry]) {
                    updates['firstSeen.' + newCountry] = admin.firestore.FieldValue.serverTimestamp();
                }
            } catch(e) {
                console.warn('[COUNTRY STATS] firstSeen check failed:', e.message);
            }
        }

        if (Object.keys(updates).length === 0) return null;

        try {
            await statsRef.set(updates, { merge: true });
            console.log('[COUNTRY STATS] ' + prevCountry + ' → ' + newCountry + ' for uid=' + context.params.userId);
        } catch(e) {
            console.error('[COUNTRY STATS] Error:', e);
        }
        return null;
    });

// ══════════════════════════════════════════════════════════════════════
// 🌍 COUNTRY STATS — Weekly full recount safeguard
// Runs every Sunday at 3 AM UTC. Counts ALL users with country set,
// overwrites stats/countries with a fresh accurate tally.
// This ensures the world map never drifts due to missed trigger fires.
// ══════════════════════════════════════════════════════════════════════
exports.recountCountryStats = onSchedule({ schedule: '0 3 * * 0', timeZone: 'UTC' }, async (ctx) => {
        console.log('[COUNTRY RECOUNT] Starting full recount...');
        const counts = {};
        let processed = 0;
        let cursor = null;

        // Page through ALL users with country set (no limit)
        while (true) {
            let query = db.collection('users').where('country', '>', '').orderBy('country').limit(500);
            if (cursor) query = query.startAfter(cursor);
            const snap = await query.get();
            if (snap.empty) break;

            snap.forEach(doc => {
                const c = (doc.data().country || '').trim();
                if (c) counts[c] = (counts[c] || 0) + 1;
            });
            processed += snap.size;
            cursor = snap.docs[snap.docs.length - 1];
            if (snap.size < 500) break;  // last page
        }

        const countryCount = Object.keys(counts).length;
        // Preserve existing firstSeen timestamps — only add new ones, never overwrite
        const existingDoc = await db.collection('stats').doc('countries').get();
        const existingFirstSeen = existingDoc.exists ? (existingDoc.data().firstSeen || {}) : {};
        const firstSeenUpdate = {};
        Object.keys(counts).forEach(c => {
            firstSeenUpdate[c] = existingFirstSeen[c] || admin.firestore.Timestamp.now();
        });
        await db.collection('stats').doc('countries').set({ counts, firstSeen: firstSeenUpdate, lastRecount: admin.firestore.FieldValue.serverTimestamp(), totalUsersWithCountry: processed }, { merge: false });
        console.log('[COUNTRY RECOUNT] Done. Countries: ' + countryCount + ', Users: ' + processed);
        return null;
    });

// ── Badge Distribution Cache Refresh ─────────────────────────────────────────
// Scans all users' badge_awards subcollections and caches counts to
// stats/badge_distribution. Runs nightly, also callable via HTTP.

async function _refreshBadgeDistribution() {
    return refreshBadgeDistribution(db, admin);
}

exports.refreshBadgeDistribution = onScheduleV2({
    schedule: '30 5 * * *',
    timeZone: 'UTC',
    memory: '512MiB',
    timeoutSeconds: 540,
}, async () => { await _refreshBadgeDistribution(); });

exports.refreshBadgeDistributionHttp = functionsV1.https.onRequest(async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        const result = await _refreshBadgeDistribution();
        res.json({ ok: true, ...result });
    } catch (e) {
        console.error('[BADGE DIST HTTP]', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── Nacho Announce (Bug #6 Fix) ──────────────────────────────────────────────
// Replaces direct client writes to /announcements which allowed any authenticated
// user (including anonymous) to inject fake "official Nacho" messages with
// arbitrary markdown links (e.g. phishing "claim your airdrop" links).
// Rules now set allow create: if false; this function is the only write path.
exports.nachoAnnounce = functionsV1.https.onCall(async (data, context) => {
    // 1. Auth: must be signed in and not anonymous
    if (!context.auth) {
        throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    if (context.auth.token.firebase && context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functionsV1.https.HttpsError('permission-denied', 'Sign in required');
    }
    // NOTE: nachoAnnounce is called by regular users for badge/trifecta/quiz announcements.
    // Protection is: non-anonymous auth + rate limiting + link/hash allowlists.
    // Admin-only gate was a mistake — broke all user-triggered GGs announcements (2026-08-04).

    // 2. Rate limit: 5 announcements per 60s per UID (client-side rate limit is
    //    bypassable; this is the server-side enforcement)
    const uid = context.auth.uid;
    const rateLimitRef = db.collection('rate_limits').doc('announce_' + uid);
    await db.runTransaction(async (tx) => {
        const doc = await tx.get(rateLimitRef);
        const now = Date.now();
        const windowMs = 60000;
        const maxCount = 5;
        if (doc.exists) {
            const d = doc.data();
            const windowStart = d.windowStart && d.windowStart.toDate ? d.windowStart.toDate().getTime() : 0;
            if (now - windowStart < windowMs) {
                if ((d.count || 0) >= maxCount) {
                    throw new functionsV1.https.HttpsError('resource-exhausted', 'Too many announcements');
                }
                tx.update(rateLimitRef, { count: (d.count || 0) + 1 });
            } else {
                tx.set(rateLimitRef, { windowStart: admin.firestore.FieldValue.serverTimestamp(), count: 1 });
            }
        } else {
            tx.set(rateLimitRef, { windowStart: admin.firestore.FieldValue.serverTimestamp(), count: 1 });
        }
    });

    // 3. Validate text
    const text = (data.text || '').trim();
    if (!text || text.length < 1 || text.length > 2000) {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Invalid text');
    }

    // 4a. HTTPS markdown links: only bitcoineducation.quest
    const ALLOWED_LINK_HOSTS = ['bitcoineducation.quest'];
    const linkRegex = /\[([^\]]*)\]\((https?:\/\/[^\)]+)\)/g;
    let match;
    while ((match = linkRegex.exec(text)) !== null) {
        try {
            const linkHost = new URL(match[2]).hostname.toLowerCase();
            if (!ALLOWED_LINK_HOSTS.some(h => linkHost === h || linkHost.endsWith('.' + h))) {
                throw new functionsV1.https.HttpsError('invalid-argument', 'Links must point to bitcoineducation.quest');
            }
        } catch (e) {
            if (e instanceof functionsV1.https.HttpsError) throw e;
            throw new functionsV1.https.HttpsError('invalid-argument', 'Invalid link URL');
        }
    }

    // 4b. Hash markdown links: only [a-zA-Z0-9_-] — blocks stored XSS via onclick injection
    //     (any other #link form is rejected entirely)
    const hashLinkRegex = /\[([^\]]*)\]\(#([^)]+)\)/g;
    while ((match = hashLinkRegex.exec(text)) !== null) {
        if (!/^[a-zA-Z0-9_-]+$/.test(match[2])) {
            throw new functionsV1.https.HttpsError('invalid-argument', 'Invalid hash link');
        }
    }

    // 4c. Reject other URL schemes that could become links in future renderers
    if (/\[[^\]]*\]\(\s*(javascript|data|vbscript):/i.test(text)) {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Disallowed link scheme');
    }

    // 5. Write via Admin SDK (bypasses allow create: if false rule)
    // mentionUid must be the caller (or omitted) — prevents hijacking another user's profile chip
    let mentionUid = data.mentionUid || uid;
    if (typeof mentionUid !== 'string' || mentionUid.length > 128 || mentionUid !== uid) {
        mentionUid = uid;
    }
    const msgData = {
        uid: uid,
        name: '🦌 Nacho',
        text: text,
        isNachoAuto: true,
        ts: admin.firestore.FieldValue.serverTimestamp(),
        mentionUid: mentionUid,
        postedByUid: uid, // audit trail — who triggered this Nacho post
    };

    await db.collection('announcements').add(msgData);
    return { ok: true };
});


// ── PVP Round Resolution (server-side, tamper-proof) ────────────
const { pvpResolveRound } = require('./src/pvpResolve');
exports.pvpResolveRound = pvpResolveRound;

// ── Peer Friendship Levels ───────────────────────────────────────────────────
const { updatePeerLevelAfterGift } = require('./src/peerLevel');


// ── Merge Anonymous Badges into Existing Account ────────────────────────────
// Called once when an anonymous user signs in to an existing account.
// Anonymous users can't write to Firestore, so their earned badges live only in
// localStorage. This CF merges that badge array into the real account's
// visibleBadges (server-side, deduplicated, validated against BADGE_VALUES catalog).
// No XP is re-awarded — badge records are written directly via Admin SDK.
exports.mergeAnonBadges = functionsV1.https.onCall(async (data, context) => {
    await secondFactor.requireSecondFactor(secondFactor.stamp(data, context));
    if (!context.auth) {
        throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const uid = context.auth.uid;
    if (context.auth.token.firebase && context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functionsV1.https.HttpsError('failed-precondition', 'Cannot merge for anonymous account');
    }
    // Client badge ids are ignored. Badges are recomputed from server counters.
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
        throw new functionsV1.https.HttpsError('not-found', 'User document not found');
    }
    if (userDoc.data().anonBadgesMerged) {
        if (!userDoc.data().mergedAnon) await userRef.update({ mergedAnon: true });
        return { merged: 0, skipped: 0, alreadyDone: true };
    }
    const anonUid = data && typeof data.anonUid === 'string' ? data.anonUid : '';
    let linkedAnon = false;
    if (anonUid && anonUid !== uid && /^[A-Za-z0-9]{10,128}$/.test(anonUid)) {
        try {
            const rec = await admin.auth().getUser(anonUid);
            linkedAnon = !rec.providerData || rec.providerData.length === 0;
        } catch (e) {
            linkedAnon = false;
        }
    }
    let merged = 0;
    if (linkedAnon) {
        const ids = badgeRules.verifiedIds();
        for (let i = 0; i < ids.length; i++) {
            try {
                const granted = await require('./src/grantBadge').grantBadgeIfEarned(db, admin, uid, ids[i]);
                if (granted && granted.granted) merged++;
            } catch (e) { /* one badge must not abort the recompute */ }
        }
    }
    await userRef.update({ anonBadgesMerged: true, mergedAnon: true });
    console.log('[mergeAnonBadges] recomputed', uid, 'linkedAnon', linkedAnon, 'merged', merged);
    return { merged: merged, skipped: 0, recomputed: true };
});

// ── Daily Firestore Backup ────────────────────────────────────────────────────
// Exports all collections to gs://bitcoin-education-archive-backups/
// Runs daily at 2 AM UTC. Bucket lifecycle deletes exports older than 90 days.
// Bucket must be in 'us' multi-region (us-central1 causes INVALID_ARGUMENT).
exports.dailyFirestoreBackup = onSchedule('0 2 * * *', async (event) => {
    const projectId = 'bitcoin-education-archive';
    const bucket = `gs://${projectId}-backups`;
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const exportPath = `${bucket}/${timestamp}`;

    const token = await admin.app().options.credential.getAccessToken();
    const res = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default):exportDocuments`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ outputUriPrefix: exportPath })
        }
    );
    const result = await res.json();
    if (result.error) {
        console.error('[BACKUP] Export failed:', JSON.stringify(result.error));
        throw new Error(result.error.message);
    }
    console.log(`[BACKUP] Export started → ${exportPath}`, result.name);
});

// ================================================================
// NACHO RADIO — Auto-DJ that keeps beats playing in Global Chat
// Runs every minute: starts Nacho when no human is DJing,
// advances to next track when current one finishes.
// Schema mirrors the live_dj doc written by human DJs.
// ================================================================
exports.nachoRadioTick = onSchedule({
    schedule: 'every 1 minutes',
    timeZone: 'UTC',
    region: 'us-central1',
    memory: '256MiB',
}, async (event) => {
    const djRef  = db.collection('global_chat_meta').doc('live_dj');
    const radioRef = db.collection('global_chat_meta').doc('nacho_radio');

    const [djDoc, radioDoc] = await Promise.all([djRef.get(), radioRef.get()]);
    const dj    = djDoc.exists ? djDoc.data() : {};
    const radio = radioDoc.exists ? radioDoc.data() : {};

    // ── 1. Human DJ is live — leave them alone ─────────────────
    if (dj.active && dj.djUid && dj.djUid !== 'nacho-dj') {
        console.log('[NachoRadio] Human DJ active:', dj.djUid);
        return;
    }

    const now = Date.now();

    // ── 2. Nacho track still playing — nothing to do ────────────
    if (dj.active && dj.isNachoDJ && dj.trackStartedAt && dj.trackDuration) {
        const startMs = dj.trackStartedAt._seconds
            ? dj.trackStartedAt._seconds * 1000
            : (dj.trackStartedAt.toMillis ? dj.trackStartedAt.toMillis() : now);
        const elapsed = (now - startMs) / 1000;
        const remaining = dj.trackDuration - elapsed;
        if (remaining > 5) {
            console.log(`[NachoRadio] Playing: "${dj.trackTitle}" — ${remaining.toFixed(0)}s left`);
            return;
        }
    }

    // ── 3. Need to pick next track ────────────────────────────────
    const playedRecently = (radio.playedRecently || []).slice(-80);

    // Fetch up to 500 playable tracks
    let snap;
    try {
        snap = await db.collection('beats_tracks').orderBy('title').limit(500).get();
    } catch (e) {
        console.error('[NachoRadio] fetch error:', e.message);
        return;
    }

    let candidates = [];
    snap.forEach(d => {
        const t = d.data();
        if (t.hidden === true) return;
        if (
            t.audioUrl &&
            (t.duration || 0) >= 60 &&
            t.genre !== 'podcast' &&
            !playedRecently.includes(d.id)
        ) {
            candidates.push({ id: d.id, ...t });
        }
    });

    // If pool runs dry, reset played history and try again
    if (candidates.length < 5) {
        console.log('[NachoRadio] Pool exhausted — resetting history');
        candidates = [];
        snap.forEach(d => {
            const t = d.data();
            if (t.hidden === true) return;
            if (t.audioUrl && (t.duration || 0) >= 60 && t.genre !== 'podcast') {
                candidates.push({ id: d.id, ...t });
            }
        });
        playedRecently.length = 0;
    }

    if (candidates.length === 0) {
        console.error('[NachoRadio] No playable tracks found');
        return;
    }

    const track    = candidates[Math.floor(Math.random() * candidates.length)];
    const publicTitle = beatsCensor(track.title || 'Untitled');
    const publicArtist = beatsCensor(track.artist || track.authorName || 'Unknown');
    const wasActive = dj.active === true;
    const songCount = (radio.songCount || 0) + 1;
    const newPlayed = [...playedRecently, track.id];

    const batch = db.batch();

    // Update live_dj doc
    batch.set(djRef, {
        djUid:          'nacho-dj',
        djName:         '🦌 Nacho',
        isNachoDJ:      true,
        active:         true,
        trackId:        track.id,
        trackTitle:     publicTitle,
        trackArtist:    publicArtist,
        trackAudioUrl:  track.audioUrl,
        trackCoverArt:  track.coverArt  || track.coverUrl  || '',
        trackDuration:  track.duration  || 180,
        trackStartedAt: admin.firestore.FieldValue.serverTimestamp(),
        artistUid:      track.authorId  || '',
        songCount:      songCount,
        playbackTime:   0,
        playbackUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        startedAt:      wasActive ? (dj.startedAt || admin.firestore.FieldValue.serverTimestamp())
                                  : admin.firestore.FieldValue.serverTimestamp(),
    });

    // Persist radio state
    batch.set(radioRef, {
        playedRecently: newPlayed.slice(-80),
        songCount,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    // Announce in chat only when going live from inactive, or every 10 tracks
    const shouldAnnounce = !wasActive || (songCount % 10 === 1);
    if (shouldAnnounce) {
        const msg = wasActive
            ? `🦌 Nacho Radio: "${publicTitle}" by ${publicArtist} is up next 🎵 Tune in!`
            : `🦌 **Nacho Radio** is live! Spinning beats from the Bitcoin Beats library. Now playing: "${publicTitle}" by ${publicArtist} 🎵 Tune in!`;
        await db.collection('global_chat').add({
            uid:          'nacho-dj',
            name:         '🦌 Nacho',
            text:         msg,
            ts:           admin.firestore.FieldValue.serverTimestamp(),
            isNachoAuto:  true,
        }).catch(e => console.warn('[NachoRadio] chat post failed:', e.message));
    }

    console.log(`[NachoRadio] ▶ "${track.title}" by ${track.artist || track.authorName} (${track.duration}s) | song #${songCount}`);
});


// =============================================
// GIFTING, KEYS, CIPHERS
// Handlers live in src/gifting.js (rewards, limits, ledger, faucet payout).
// =============================================
const {
    awardDailyGifts,
    openGift,
    sendKeys,
    decryptCipher,
    ackCipherShare,
    claimCipherWin,
    listMyCipherWins,
    adminListCipherWins,
    adminMarkCipherWinPaid,
} = require('./src/gifting');
exports.awardDailyGifts = awardDailyGifts;
exports.openGift = openGift;
exports.sendKeys = sendKeys;
exports.decryptCipher = decryptCipher;
exports.ackCipherShare = ackCipherShare;
exports.claimCipherWin = claimCipherWin;
exports.listMyCipherWins = listMyCipherWins;
exports.adminListCipherWins = adminListCipherWins;
exports.adminMarkCipherWinPaid = adminMarkCipherWinPaid;

// Daily say-hi. App Check is required, same as claimSats. The handlers
// grant XP and tickets only inside a transaction keyed by uid + server day.
const { bindResetLightningAddress } = require('./src/resetLightningAddress');
const resetLnFns = bindResetLightningAddress(functionsV1, {
    admin: admin,
    db: db,
    verifyTurnstile: verifyTurnstile,
    requireSecondFactor: function (data, context) {
        return secondFactor.requireFreshStepUp(secondFactor.stamp(data, context), 'resetLightningAddress');
    },
});
exports.resetLightningAddressOnce = resetLnFns.resetLightningAddressOnce;

// Faction choice. App Check is on the module bind so the index.js count stays
// the claimSats plus four PvP callables. syncUserFactionPoints delegates to it.
const { bindChooseFaction } = require('./src/chooseFaction');
const factionFns = bindChooseFaction(functionsV1, { admin: admin, db: db });
exports.chooseFaction = factionFns.chooseFaction;
exports.syncUserFactionPoints = factionFns.syncUserFactionPoints;

const { bindSayHi } = require('./src/sayHi');
const sayHiFns = bindSayHi(functionsV1, admin, db);
exports.armSayHi = sayHiFns.armSayHi;
exports.claimSayHi = sayHiFns.claimSayHi;

// Hidden reply bonus. App Check is required, same as claimSats. The handler
// grants XP only inside a transaction after it reads the chat message.
const { bindReplyBonus } = require('./src/replyBonus');
const replyBonusFns = bindReplyBonus(functionsV1, admin, db);
exports.claimReplyBonus = replyBonusFns.claimReplyBonus;
// claimOnboardingQuestStep, prepareGuestLink, linkGuestAccount, and setUsername.
const { registerOnboarding } = require('./src/onboardingApi');
Object.assign(exports, registerOnboarding({ db: db, admin: admin, functionsV1: functionsV1 }));

// Account deletion. Owner (recent sign-in) or admin. Admin SDK writes only.
const { bindDeleteAccount } = require('./src/deleteAccount');
const deleteAccountFns = bindDeleteAccount(functionsV1, admin, db);
exports.deleteAccount = deleteAccountFns.deleteAccount;

// Daily Timechain TV watch reward. Presence counting stays on
// tctvAggregatePresence; this callable only credits watch time.
const { tctvWatchHeartbeat } = require('./tctv-watch-callable');
exports.tctvWatchHeartbeat = tctvWatchHeartbeat;

// Clears the one-time backfill badge toast. The script writes the flag.
const { ackBadgeBackfillToast } = require('./ack-badge-backfill');
exports.ackBadgeBackfillToast = ackBadgeBackfillToast;

// Topic discussions. Clients read topic_discussions; these callables are the
// only writers. postTopicComment awaits Nacho's reply before returning.
const { createTopicDiscussion } = require('./src/topicDiscussion');
const topicDiscussion = createTopicDiscussion({
    db: db,
    admin: admin,
    HttpsError: functionsV1.https.HttpsError,
});
exports.postTopicComment = functionsV1.runWith({ timeoutSeconds: 30, memory: '256MB' }).https.onCall(topicDiscussion.postTopicComment);
exports.reportTopicComment = functionsV1.https.onCall(topicDiscussion.reportTopicComment);
exports.moderateTopicPost = functionsV1.https.onCall(topicDiscussion.moderateTopicPost);
exports.deleteTopicComment = functionsV1.https.onCall(topicDiscussion.deleteTopicComment);

// Topic ↔ Pleb Talk mirror. Deploy these with the callables above:
// postTopicComment, deleteTopicComment, moderateTopicPost,
// onForumPost, onForumShoutout, onForumPostBadgeCount, onForumReplyBadgeCount,
// onForumReplyToTopic, onForumReplyMirrorSync, onForumReplyMirrorDelete,
// onForumPostMirrorDelete, onTopicPostMirrorSync.
// Rules diff: forum_posts and forum_replies reject client writes of origin,
// mirrorOf, mirrorSync, topicChannel, topicPost, topicLink, anchorIndex,
// anchorHash, noAward, and mirrored. On a mirrored doc, hidden and deleted
// are frozen too. Topic discussion posts stay server-written. The author
// may change only body, and only while that doc is not hidden or deleted.
// Ordinary forum creates are not paced. users/{uid}/xp_ledger is server-only
// (topic conversation XP, source topic_conversation).
const topicForumMirror = require('./src/topicForumMirror');
const TOPIC_MIRROR_OPTS = { maxInstances: 10 };

exports.onForumReplyToTopic = onDocumentCreated({
    document: 'forum_replies/{replyId}',
    maxInstances: TOPIC_MIRROR_OPTS.maxInstances,
}, async (event) => {
    if (!event.data) return null;
    try {
        const fresh = await db.collection('forum_replies').doc(event.params.replyId).get();
        if (!fresh.exists) return null;
        const data = fresh.data() || {};
        if (data.deleted === true || data.hidden === true) return null;
        await topicForumMirror.mirrorForumReplyToTopic({
            db: db,
            admin: admin,
            replyId: event.params.replyId,
            data: data,
        });
    } catch (e) {
        console.warn('[onForumReplyToTopic]', e && e.message ? e.message : '');
    }
    return null;
});

exports.onForumReplyMirrorSync = onDocumentUpdated({
    document: 'forum_replies/{replyId}',
    maxInstances: TOPIC_MIRROR_OPTS.maxInstances,
}, async (event) => {
    if (!event.data) return null;
    try {
        await topicForumMirror.syncForumReplyEdit({
            db: db,
            admin: admin,
            replyId: event.params.replyId,
            before: event.data.before.data(),
            after: event.data.after.data(),
        });
    } catch (e) {
        console.warn('[onForumReplyMirrorSync]', e && e.message ? e.message : '');
    }
    return null;
});

exports.onForumReplyMirrorDelete = onDocumentDeleted({
    document: 'forum_replies/{replyId}',
    maxInstances: TOPIC_MIRROR_OPTS.maxInstances,
}, async (event) => {
    try {
        await topicForumMirror.syncForumReplyDelete({
            db: db,
            admin: admin,
            replyId: event.params.replyId,
            before: event.data && event.data.data ? event.data.data() : {},
        });
    } catch (e) {
        console.warn('[onForumReplyMirrorDelete]', e && e.message ? e.message : '');
    }
    return null;
});

exports.onForumPostMirrorDelete = onDocumentDeleted({
    document: 'forum_posts/{postId}',
    maxInstances: TOPIC_MIRROR_OPTS.maxInstances,
}, async (event) => {
    try {
        await topicForumMirror.syncForumPostDelete({
            db: db,
            admin: admin,
            postId: event.params.postId,
            before: event.data && event.data.data ? event.data.data() : {},
        });
    } catch (e) {
        console.warn('[onForumPostMirrorDelete]', e && e.message ? e.message : '');
    }
    return null;
});

exports.onTopicPostMirrorSync = onDocumentUpdated({
    document: 'topic_discussions/{channelId}/posts/{postId}',
    maxInstances: TOPIC_MIRROR_OPTS.maxInstances,
}, async (event) => {
    if (!event.data) return null;
    try {
        await topicForumMirror.syncTopicToForum({
            db: db,
            admin: admin,
            channelId: event.params.channelId,
            postId: event.params.postId,
            before: event.data.before.data(),
            after: event.data.after.data(),
        });
    } catch (e) {
        console.warn('[onTopicPostMirrorSync]', e && e.message ? e.message : '');
    }
    return null;
});
