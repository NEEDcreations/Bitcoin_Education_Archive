const functions = require('firebase-functions');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const { authenticator } = require("otplib");
const QRCode = require('qrcode');
const fetch = require('node-fetch');

admin.initializeApp();
const db = admin.firestore();
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
// Returns true and sets CORS header if valid; sends 403 and returns false if not.
function requireAdmin(req, res) {
    const expected = process.env.ADMIN_TOKEN;
    if (!expected) {
        console.error('[requireAdmin] ADMIN_TOKEN env var not set');
        res.status(500).json({ error: 'server misconfiguration' });
        return false;
    }
    const provided = req.headers['x-admin-token'] || req.query.t || '';
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

const { NWCClient } = require('@getalby/sdk');
const bolt11 = require('bolt11');

// ===== SATS FAUCET CONFIG =====
const FAUCET = {
    POINTS_PER_SAT: 10,
    MIN_WITHDRAWAL_SATS: 100,
    MAX_PER_CLAIM_SATS: 500,
    MAX_DAILY_PER_USER_SATS: 500,
    MAX_LIFETIME_PER_USER_SATS: 10000,
    GLOBAL_DAILY_MAX_SATS: 10000,
    COOLDOWN_HOURS: 24,
    MIN_ACCOUNT_AGE_DAYS: 7,
    MIN_CHANNELS_READ: 10,
    WALLET_BALANCE_FLOOR_SATS: 5000,
    NWC_URL: process.env.NWC_URL || ''
};

// Generate TOTP secret and QR code for user
exports.totpSetup = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');

    const uid = context.auth.uid;
    const email = context.auth.token.email || 'user';

    // Generate secret
    const secret = authenticator.generateSecret();

    // Store temporarily (not verified yet)
    await db.collection('totp_pending').doc(uid).set({
        secret: secret,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Generate QR code
    const otpauth = authenticator.keyuri(email, "Bitcoin Education Archive", secret);
    const qrDataUrl = await QRCode.toDataURL(otpauth);

    return { qr: qrDataUrl, secret: secret };
});

// Verify TOTP code and enable it
exports.totpVerify = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    if (!data.code) throw new functions.https.HttpsError('invalid-argument', 'Code required');

    const uid = context.auth.uid;

    // Rate limiting: max 5 attempts per 2-minute window (atomic transaction)
    const rlRef = db.collection('totp_rate_limits').doc(uid + '_verify');
    await db.runTransaction(async (tx) => {
        const rlDoc = await tx.get(rlRef);
        if (rlDoc.exists) {
            const rd = rlDoc.data();
            const ws = rd.windowStart ? (rd.windowStart.toDate ? rd.windowStart.toDate() : new Date(rd.windowStart)) : null;
            if (ws && (Date.now() - ws.getTime()) < 120000) {
                if ((rd.attempts || 0) >= 5) throw new functions.https.HttpsError('resource-exhausted', 'Too many attempts. Wait 2 minutes.');
                tx.update(rlRef, { attempts: (rd.attempts || 0) + 1 });
            } else {
                tx.set(rlRef, { attempts: 1, windowStart: admin.firestore.FieldValue.serverTimestamp() });
            }
        } else {
            tx.set(rlRef, { attempts: 1, windowStart: admin.firestore.FieldValue.serverTimestamp() });
        }
    });

    // Get pending secret
    const pending = await db.collection('totp_pending').doc(uid).get();
    if (!pending.exists) throw new functions.https.HttpsError('not-found', 'No pending TOTP setup. Start setup first.');

    const secret = pending.data().secret;

    // Verify the code
    var isValid = authenticator.verify({ token: data.code, secret: secret });
    if (!isValid) throw new functions.https.HttpsError('invalid-argument', 'Invalid code. Try again.');

    // Store verified secret
    await db.collection('totp_secrets').doc(uid).set({
        secret: secret,
        enabled: true,
        enabledAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Update user doc
    await db.collection('users').doc(uid).update({ totpEnabled: true });

    // Clean up pending
    await db.collection('totp_pending').doc(uid).delete();

    return { success: true };
});

// Validate TOTP code on sign-in
exports.totpCheck = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    if (!data.code) throw new functions.https.HttpsError('invalid-argument', 'Code required');

    const uid = context.auth.uid;

    // Rate limiting: max 5 attempts per 2-minute window (atomic transaction to prevent race condition)
    const totpRateRef = db.collection('totp_rate_limits').doc(uid);
    await db.runTransaction(async (t) => {
        const doc = await t.get(totpRateRef);
        const now = Date.now();
        if (doc.exists) {
            const d = doc.data();
            const ws = d.windowStart ? (d.windowStart.toDate ? d.windowStart.toDate() : new Date(d.windowStart)) : null;
            if (ws && (now - ws.getTime()) < 120000) {
                if ((d.attempts || 0) >= 5) throw new functions.https.HttpsError('resource-exhausted', 'Too many attempts. Wait 2 minutes.');
                t.set(totpRateRef, { attempts: (d.attempts || 0) + 1, windowStart: d.windowStart }, { merge: true });
            } else {
                t.set(totpRateRef, { attempts: 1, windowStart: admin.firestore.FieldValue.serverTimestamp() });
            }
        } else {
            t.set(totpRateRef, { attempts: 1, windowStart: admin.firestore.FieldValue.serverTimestamp() });
        }
    });

    const doc = await db.collection('totp_secrets').doc(uid).get();
    if (!doc.exists || !doc.data().enabled) {
        throw new functions.https.HttpsError('not-found', 'TOTP not enabled');
    }

    const secret = doc.data().secret;
    var isValid = authenticator.verify({ token: data.code, secret: secret });

    if (!isValid) throw new functions.https.HttpsError('invalid-argument', 'Invalid code');

    // Reset rate limit on success
    await totpRateRef.delete().catch(function() {});

    // Mark session as verified
    await db.collection('totp_sessions').doc(uid).set({
        verified: true,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
});

// Disable TOTP
exports.totpDisable = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    if (!data.code) throw new functions.https.HttpsError('invalid-argument', 'Enter your current code to disable');

    const uid = context.auth.uid;

    // Rate limiting: max 5 attempts per 2-minute window (atomic transaction)
    const rlRef = db.collection('totp_rate_limits').doc(uid + '_disable');
    await db.runTransaction(async (tx) => {
        const rlDoc = await tx.get(rlRef);
        if (rlDoc.exists) {
            const rd = rlDoc.data();
            const ws = rd.windowStart ? (rd.windowStart.toDate ? rd.windowStart.toDate() : new Date(rd.windowStart)) : null;
            if (ws && (Date.now() - ws.getTime()) < 120000) {
                if ((rd.attempts || 0) >= 5) throw new functions.https.HttpsError('resource-exhausted', 'Too many attempts. Wait 2 minutes.');
                tx.update(rlRef, { attempts: (rd.attempts || 0) + 1 });
            } else {
                tx.set(rlRef, { attempts: 1, windowStart: admin.firestore.FieldValue.serverTimestamp() });
            }
        } else {
            tx.set(rlRef, { attempts: 1, windowStart: admin.firestore.FieldValue.serverTimestamp() });
        }
    });

    const doc = await db.collection('totp_secrets').doc(uid).get();
    if (!doc.exists) throw new functions.https.HttpsError('not-found', 'TOTP not enabled');

    // Verify code before disabling
    var isValid = authenticator.verify({ token: data.code, secret: doc.data().secret });
    if (!isValid) throw new functions.https.HttpsError('invalid-argument', 'Invalid code. Must verify to disable.');

    await db.collection('totp_secrets').doc(uid).delete();
    await db.collection('totp_sessions').doc(uid).delete();
    await db.collection('users').doc(uid).update({ totpEnabled: false });

    return { success: true };
});

// Check if user has TOTP enabled
exports.totpStatus = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');

    const uid = context.auth.uid;
    const doc = await db.collection('totp_secrets').doc(uid).get();
    const sessionDoc = await db.collection('totp_sessions').doc(uid).get();

    return {
        enabled: doc.exists && doc.data().enabled === true,
        sessionVerified: sessionDoc.exists && sessionDoc.data().verified === true
    };
});

// =============================================
// Streak Reminder Push Notifications
// Runs daily at 8pm UTC (adjustable)
// =============================================
// Fires at midnight UTC = 7 PM ET, warning users 5h before the 5 AM UTC (midnight ET) streak reset
exports.streakReminder = onSchedule({ schedule: '0 0 * * *', timeZone: 'UTC' }, async (event) => {
        const today = getOffsetDateKey(); // offset key — warns about the correct reset boundary

        // Find users with push tokens who visited yesterday but NOT today
        // (their streak is about to expire at midnight)
        const tokensSnap = await db.collection('push_tokens').get();
        if (tokensSnap.empty) return null;

        const messages = [];

        for (const tokenDoc of tokensSnap.docs) {
            const uid = tokenDoc.id;
            const token = tokenDoc.data().token;
            if (!token) continue;

            // Get user data
            try {
                const userDoc = await db.collection('users').doc(uid).get();
                if (!userDoc.exists) continue;

                const userData = userDoc.data();
                const lastVisit = userData.lastVisit;
                const streak = userData.streak || 0;

                // Only notify if they have an active streak (2+) and haven't visited today
                if (streak >= 2 && lastVisit && lastVisit !== today) {
                    messages.push({
                        token: token,
                        notification: {
                            title: '🔥 Your ' + streak + '-day streak is about to expire!',
                            body: 'Visit the Bitcoin Education Archive before midnight to keep it alive. Don\'t lose your progress!'
                        },
                        data: {
                            url: 'https://bitcoineducation.quest'
                        },
                        webpush: {
                            fcmOptions: {
                                link: 'https://bitcoineducation.quest'
                            }
                        }
                    });
                }
            } catch (e) {
                console.log('Error checking user ' + uid + ':', e.message);
            }
        }

        if (messages.length === 0) return null;

        // Send notifications (batch up to 500)
        const batches = [];
        for (let i = 0; i < messages.length; i += 500) {
            batches.push(messages.slice(i, i + 500));
        }

        let sent = 0;
        let failed = 0;
        for (const batch of batches) {
            const results = await admin.messaging().sendEach(batch);
            results.responses.forEach((resp, idx) => {
                if (resp.success) {
                    sent++;
                } else {
                    failed++;
                    // Remove invalid tokens
                    if (resp.error && (
                        resp.error.code === 'messaging/invalid-registration-token' ||
                        resp.error.code === 'messaging/registration-token-not-registered'
                    )) {
                        const uid = batches[0][idx] ? null : null; // Can't easily get UID here
                        // We'll clean up stale tokens separately
                    }
                }
            });
        }

        console.log('Streak reminders sent: ' + sent + ', failed: ' + failed);
        return null;
    });

// =============================================
// Weekly Quest Reminder (every Monday 3 PM UTC)
// =============================================
exports.weeklyQuestReminder = onSchedule({ schedule: '0 15 * * 1', timeZone: 'UTC' }, async (event) => {
        const tokensSnap = await db.collection('push_tokens').get();
        if (tokensSnap.empty) return null;

        const messages = [];
        for (const tokenDoc of tokensSnap.docs) {
            const token = tokenDoc.data().token;
            if (!token) continue;
            messages.push({
                token: token,
                notification: {
                    title: '⚡ Start your Quest!',
                    body: 'Learn more about Bitcoin! New questions and channels are waiting for you.'
                },
                data: { url: 'https://bitcoineducation.quest' },
                webpush: { fcmOptions: { link: 'https://bitcoineducation.quest' } }
            });
        }

        if (messages.length === 0) return null;

        let sent = 0, failed = 0;
        for (let i = 0; i < messages.length; i += 500) {
            const batch = messages.slice(i, i + 500);
            const results = await admin.messaging().sendEach(batch);
            results.responses.forEach(r => { if (r.success) sent++; else failed++; });
        }

        console.log('Weekly quest reminders sent: ' + sent + ', failed: ' + failed);
        return null;
    });

// =============================================
// Clean up stale/invalid push tokens (weekly)
// =============================================
exports.cleanPushTokens = onSchedule({ schedule: '0 3 * * 0', timeZone: 'UTC' }, async (event) => {
        const tokensSnap = await db.collection('push_tokens').get();
        let cleaned = 0;

        for (const tokenDoc of tokensSnap.docs) {
            const token = tokenDoc.data().token;
            if (!token) {
                await tokenDoc.ref.delete();
                cleaned++;
                continue;
            }

            // Try a dry-run send to check if token is still valid
            try {
                await admin.messaging().send({
                    token: token,
                    data: { test: 'true' }
                }, true); // dry run
            } catch (e) {
                if (e.code === 'messaging/invalid-registration-token' ||
                    e.code === 'messaging/registration-token-not-registered') {
                    await tokenDoc.ref.delete();
                    // Also remove from user doc
                    try {
                        await db.collection('users').doc(tokenDoc.id).update({
                            pushToken: admin.firestore.FieldValue.delete()
                        });
                    } catch (e2) {}
                    cleaned++;
                }
            }
        }

        console.log('Cleaned ' + cleaned + ' stale push tokens');
        return null;
    });

// =============================================
// Nostr Sign-In (NIP-07)
// Verify Schnorr signature and issue Firebase custom token
// =============================================
exports.nostrAuth = functions.https.onCall(async (data, context) => {
    const { pubkey, sig, event } = data;

    if (!pubkey || !sig || !event) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing pubkey, sig, or event');
    }

    // Rate limiting: max 5 nostrAuth calls per IP per hour (atomic transaction)
    const nostrIP = (context.rawRequest && context.rawRequest.ip) || 'unknown';
    if (nostrIP !== 'unknown') {
        const nostrRateRef = db.collection('rate_limits').doc('nostr_' + nostrIP.replace(/[./]/g, '_'));
        await db.runTransaction(async (tx) => {
            const nostrRateDoc = await tx.get(nostrRateRef);
            if (nostrRateDoc.exists) {
                const rd = nostrRateDoc.data();
                const windowStart = rd.windowStart ? (rd.windowStart.toDate ? rd.windowStart.toDate() : new Date(rd.windowStart)) : null;
                if (windowStart && (Date.now() - windowStart.getTime()) < 3600000) {
                    if ((rd.attempts || 0) >= 5) {
                        throw new functions.https.HttpsError('resource-exhausted', 'Too many sign-in attempts. Try again later.');
                    }
                    tx.update(nostrRateRef, { attempts: (rd.attempts || 0) + 1 });
                } else {
                    tx.set(nostrRateRef, { attempts: 1, windowStart: admin.firestore.FieldValue.serverTimestamp() });
                }
            } else {
                tx.set(nostrRateRef, { attempts: 1, windowStart: admin.firestore.FieldValue.serverTimestamp() });
            }
        });
    }

    // Validate pubkey format (64 hex chars)
    if (!/^[a-f0-9]{64}$/.test(pubkey)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid pubkey format');
    }

    // Parse and validate the event
    let nostrEvent;
    try {
        nostrEvent = typeof event === 'string' ? JSON.parse(event) : event;
    } catch(e) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid event format');
    }

    // Verify it's a kind 27235 (NIP-98 HTTP Auth) or kind 22242 (auth) event
    if (nostrEvent.kind !== 27235 && nostrEvent.kind !== 22242) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid event kind');
    }

    // Verify event is recent (within 5 minutes)
    const eventTime = nostrEvent.created_at || 0;
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - eventTime) > 300) {
        throw new functions.https.HttpsError('invalid-argument', 'Event too old or too far in future');
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
            throw new functions.https.HttpsError('permission-denied', 'Event id mismatch - signature not bound to this event');
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
            throw new functions.https.HttpsError('permission-denied', 'Signature verification failed');
        }
    } catch(e) {
        if (e instanceof functions.https.HttpsError) throw e;
        console.error('Nostr sig verify error:', e.message, 'sig len:', sig ? sig.length : 0, 'pubkey:', pubkey ? pubkey.substring(0,16) : 'none');
        throw new functions.https.HttpsError('internal', 'Signature verification failed');
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
exports.lnAuthChallenge = functions.https.onCall(async (data, context) => {
    // Rate limiting: max 10 challenges per IP per hour (atomic transaction)
    const lnIP = (context.rawRequest && context.rawRequest.ip) || 'unknown';
    if (lnIP !== 'unknown') {
        const lnRateRef = db.collection('rate_limits').doc('lnauth_' + lnIP.replace(/[./]/g, '_'));
        await db.runTransaction(async (tx) => {
            const lnRateDoc = await tx.get(lnRateRef);
            if (lnRateDoc.exists) {
                const rd = lnRateDoc.data();
                const ws = rd.windowStart ? (rd.windowStart.toDate ? rd.windowStart.toDate() : new Date(rd.windowStart)) : null;
                if (ws && (Date.now() - ws.getTime()) < 3600000) {
                    if ((rd.attempts || 0) >= 10) throw new functions.https.HttpsError('resource-exhausted', 'Too many requests. Try again later.');
                    tx.update(lnRateRef, { attempts: (rd.attempts || 0) + 1 });
                } else {
                    tx.set(lnRateRef, { attempts: 1, windowStart: admin.firestore.FieldValue.serverTimestamp() });
                }
            } else {
                tx.set(lnRateRef, { attempts: 1, windowStart: admin.firestore.FieldValue.serverTimestamp() });
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
exports.lnAuthCallback = functions.https.onRequest(async (req, res) => {
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
                displayName: '⚡anon-' + key.substring(0, 12),
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
exports.lnAuthVerify = functions.https.onCall(async (data, context) => {
    const { k1 } = data;
    if (!k1) throw new functions.https.HttpsError('invalid-argument', 'Missing k1');

    // Rate limiting: max 20 polls per IP per minute (atomic transaction)
    const verifyIP = (context.rawRequest && context.rawRequest.ip) || 'unknown';
    if (verifyIP !== 'unknown') {
        const vrRef = db.collection('rate_limits').doc('lnverify_' + verifyIP.replace(/[./]/g, '_'));
        await db.runTransaction(async (tx) => {
            const vrDoc = await tx.get(vrRef);
            if (vrDoc.exists) {
                const rd = vrDoc.data();
                const ws = rd.windowStart ? (rd.windowStart.toDate ? rd.windowStart.toDate() : new Date(rd.windowStart)) : null;
                if (ws && (Date.now() - ws.getTime()) < 60000) {
                    if ((rd.attempts || 0) >= 20) throw new functions.https.HttpsError('resource-exhausted', 'Too many requests');
                    tx.update(vrRef, { attempts: (rd.attempts || 0) + 1 });
                } else {
                    tx.set(vrRef, { attempts: 1, windowStart: admin.firestore.FieldValue.serverTimestamp() });
                }
            } else {
                tx.set(vrRef, { attempts: 1, windowStart: admin.firestore.FieldValue.serverTimestamp() });
            }
        });
    }

    const doc = await db.collection('lnauth_challenges').doc(k1).get();
    if (!doc.exists) {
        throw new functions.https.HttpsError('not-found', 'Challenge not found');
    }

    const challenge = doc.data();

    // Check expiry (5 minutes from creation)
    if (challenge.expiresAt) {
        const expires = challenge.expiresAt.toDate ? challenge.expiresAt.toDate() : new Date(challenge.expiresAt);
        if (Date.now() > expires.getTime()) {
            await db.collection('lnauth_challenges').doc(k1).delete();
            throw new functions.https.HttpsError('deadline-exceeded', 'Challenge expired');
        }
    }

    if (challenge.status !== 'completed') {
        throw new functions.https.HttpsError('not-found', 'Not yet authenticated');
    }

    // Generate token fresh instead of reading stored one (never persist tokens in Firestore)
    const uid = challenge.uid;
    const linkingKey = challenge.linkingKey;
    if (!uid) {
        throw new functions.https.HttpsError('internal', 'Invalid challenge state');
    }

    let token;
    try {
        token = await admin.auth().createCustomToken(uid, { lnPubkey: linkingKey || '' });
    } catch(e) {
        throw new functions.https.HttpsError('internal', 'Token generation failed');
    }

    // Delete challenge immediately (one-time use)
    await db.collection('lnauth_challenges').doc(k1).delete();

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
exports.onForumPost = functions.firestore
    .document('forum_posts/{postId}')
    .onCreate(async (snap, context) => {
        const post = snap.data();
        const postId = context.params.postId;
        const authorId = post.authorId || 'unknown';

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

// =============================================
// Push Notification: Spin Wheel Reminder
// Runs every Monday, Wednesday, Friday at 10am ET
// =============================================
exports.spinReminder = onSchedule({
    schedule: 'every monday,wednesday,friday 10:00',
    timeZone: 'America/New_York',
    retryCount: 0,
}, async (event) => {
    try {
        // Get all users with push enabled
        const usersSnap = await db.collection('users')
            .where('pushEnabled', '==', true)
            .limit(500)
            .get();

        if (usersSnap.empty) return null;

        // Get their push tokens
        const messages = [];
        for (const userDoc of usersSnap.docs) {
            const tokenDoc = await db.collection('push_tokens').doc(userDoc.id).get();
            if (tokenDoc.exists && tokenDoc.data().token) {
                messages.push({
                    token: tokenDoc.data().token,
                    notification: {
                        title: '🎡 Your daily spin is ready!',
                        body: 'Spin the wheel for free Orange Tickets! 🎟️',
                    },
                    webpush: {
                        fcmOptions: {
                            link: 'https://bitcoineducation.quest',
                        },
                    },
                });
            }
        }

        // Send in batches of 500
        if (messages.length > 0) {
            const messaging = admin.messaging();
            for (let i = 0; i < messages.length; i += 500) {
                const batch = messages.slice(i, i + 500);
                await messaging.sendEach(batch);
            }
            console.log('Sent spin reminders to ' + messages.length + ' users');
        }

        return null;
    } catch(e) {
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
exports.verifyReferral = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');

    const referredUid = context.auth.uid;

    // Find the referral doc where this user was referred
    const referralSnap = await db.collection('referrals')
        .where('referredUid', '==', referredUid)
        .where('verified', '==', false)
        .limit(1)
        .get();

    if (referralSnap.empty) return { success: false, reason: 'No pending referral found' };

    const referralDoc = referralSnap.docs[0];
    const referralData = referralDoc.data();
    const referrerUid = referralData.referrerUid;

    const referredUser = await db.collection('users').doc(referredUid).get();
    if (!referredUser.exists) throw new functions.https.HttpsError('not-found', 'User not found');

    const referrerDoc = await db.collection('users').doc(referrerUid).get();
    if (!referrerDoc.exists) return { success: false, reason: 'Referrer not found' };

    const userData = referredUser.data();
    const refData = referrerDoc.data();
    const points = userData.points || 0;
    const channelsVisited = (userData.visitedChannels || userData.visitedChannelsList || []).length;

    // Qualification: reached Maxi rank (2,140+ points)
    if (points < 2140) {
        return { success: false, reason: 'Keep learning! You need to reach Maxi rank (2,140+ points) to unlock the referral reward.' };
    }

    // ===== FRAUD CHECKS =====
    // Collect signals that this is the same person referring themselves.
    const flags = [];
    const lowerStr = s => (s == null ? null : String(s).toLowerCase().trim());

    // 1. Same email on user doc
    if (lowerStr(userData.email) && lowerStr(userData.email) === lowerStr(refData.email)) {
        flags.push('same-email-user-doc');
    }

    // 2. Same Lightning address (profile field)
    const referredLN = lowerStr(userData.lightningAddress || userData.lnAddress);
    const referrerLN = lowerStr(refData.lightningAddress || refData.lnAddress);
    if (referredLN && referredLN === referrerLN) flags.push('same-lightning-address');

    // 3. Same giveaway Lightning address
    try {
        const [gA, gB] = await Promise.all([
            db.collection('giveaway_entries').doc(referredUid).get(),
            db.collection('giveaway_entries').doc(referrerUid).get()
        ]);
        if (gA.exists && gB.exists) {
            const a = lowerStr(gA.data().lightningAddress || gA.data().lnAddress);
            const b = lowerStr(gB.data().lightningAddress || gB.data().lnAddress);
            if (a && a === b) flags.push('same-giveaway-lightning-address');
        }
    } catch (e) {}

    // 4. Firebase Auth cross-checks: same provider email, accounts created within 24h.
    try {
        const [authA, authB] = await Promise.all([
            admin.auth().getUser(referredUid).catch(() => null),
            admin.auth().getUser(referrerUid).catch(() => null)
        ]);
        if (authA && authB) {
            // Same displayName
            if (authA.displayName && lowerStr(authA.displayName) === lowerStr(authB.displayName)) {
                flags.push('same-display-name');
            }
            // Any provider email match
            const emailsA = new Set();
            const emailsB = new Set();
            (authA.providerData || []).forEach(p => p.email && emailsA.add(lowerStr(p.email)));
            (authB.providerData || []).forEach(p => p.email && emailsB.add(lowerStr(p.email)));
            if (authA.email) emailsA.add(lowerStr(authA.email));
            if (authB.email) emailsB.add(lowerStr(authB.email));
            for (const e of emailsA) { if (emailsB.has(e)) { flags.push('same-auth-email:' + e); break; } }
            // Accounts created within 24h of each other
            const tA = new Date(authA.metadata.creationTime).getTime();
            const tB = new Date(authB.metadata.creationTime).getTime();
            if (Math.abs(tA - tB) < 86400000) flags.push('accounts-created-within-24h');
        }
    } catch (e) { console.error('[verifyReferral] auth cross-check failed:', e.message); }

    // 5. Referral code chain: is the referrer himself referred back by this same user or vice versa?
    if (refData.referredBy && lowerStr(refData.referredBy) === lowerStr((userData.uid || referredUid).substring(0, 8))) {
        flags.push('circular-referral');
    }

    if (flags.length > 0) {
        // Reject + log suspicious activity for review
        try {
            await db.collection('suspicious_activity').add({
                type: 'referral-self-fraud',
                referrerUid,
                referredUid,
                flags,
                referrerEmail: refData.email || null,
                referredEmail: userData.email || null,
                referrerLN: refData.lightningAddress || refData.lnAddress || null,
                referredLN: userData.lightningAddress || userData.lnAddress || null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                action: 'referral-rejected'
            });
        } catch (e) {}
        await referralDoc.ref.update({
            verified: false,
            rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
            rejectionFlags: flags,
            ticketsAwarded: false
        });
        return { success: false, reason: 'Referral rejected: sanity check failed', flags };
    }

    // ===== Passed all checks - award tickets =====
    const batch = db.batch();
    batch.update(referralDoc.ref, {
        verified: true,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        ticketsAwarded: true
    });
    // Referrer: +50 tickets, +1 referralCount
    batch.update(db.collection('users').doc(referrerUid), {
        orangeTickets: admin.firestore.FieldValue.increment(50),
        referralTicketsEarned: admin.firestore.FieldValue.increment(50),
        referralCount: admin.firestore.FieldValue.increment(1),
    });
    // Referred user: +50 tickets for reaching Maxi rank via referral link
    batch.update(db.collection('users').doc(referredUid), {
        referralVerified: true,
        orangeTickets: admin.firestore.FieldValue.increment(50),
    });
    await batch.commit();

    return { success: true, referrerTickets: 50, referredTickets: 50 };
});

// =============================================
// NOTE: Old allowedAwards-based awardPoints removed - replaced by daily-cap version below (line ~1527)
// That version enforces 500 pts/day via atomic Firestore transaction in daily_points subcollection

// =============================================
// AUDIT FIX: Server-Side Daily Limit Check
// Spin wheel, scholar exam, quest attempts
// =============================================
exports.checkDailyLimit = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');

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
        throw new functions.https.HttpsError('invalid-argument', 'Invalid action');
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
            throw new functions.https.HttpsError('not-found', 'User not found');
        }
        console.error('[CHECK_DAILY_LIMIT_TRANS_ERR]', e);
        throw new functions.https.HttpsError('internal', 'Internal transaction error');
    }
});

// =============================================
// AUDIT FIX: Forum Content Moderation
// Server-side profanity filter with leetspeak detection
// =============================================
exports.moderateContent = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');

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
exports.bridgeToTelegram = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    if (!data.text && !data.gifUrl && !data.imageUrl && !data.imageBase64) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing content');
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
            if (bad.includes(' ')) { if (text.includes(bad)) throw new functions.https.HttpsError('invalid-argument', 'Message blocked by content filter'); }
            else { for (const w of words) { if (w === bad) throw new functions.https.HttpsError('invalid-argument', 'Message blocked by content filter'); } }
            if (bad.length >= 4 && text.includes(bad)) throw new functions.https.HttpsError('invalid-argument', 'Message blocked by content filter');
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
                throw new functions.https.HttpsError('resource-exhausted', 'Too fast - wait 3 seconds');
            }
        }
        tx.set(rateLimitRef, { lastCall: admin.firestore.FieldValue.serverTimestamp() });
    });

    // Secret lives ONLY in server-side environment variables (.env)
    const BRIDGE_URL = process.env.BRIDGE_URL || 'https://chat-bridge.needcreations.workers.dev/webhook/firestore';
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

        const fetch = require('node-fetch');
        const resp = await fetch(BRIDGE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + BRIDGE_SECRET
            },
            body: JSON.stringify({
                user: verifiedUsername,
                text: (data.text || '').substring(0, 500),
                gifUrl: data.gifUrl || '',
                imageUrl: data.imageUrl || '',
                imageBase64: data.imageBase64 || '',
                replyToName: (data.replyToName || '').substring(0, 50),
                replyToText: (data.replyToText || '').substring(0, 200),
                uid: uid,
                source: 'web'
            })
        });
        const json = await resp.json();

        // Store telegramMsgId if returned by bridge worker
        if (json.telegramMsgId && json.chatId) {
            try {
                // The caller should pass the Firestore message ID as data.messageId
                if (data.messageId) {
                    await db.collection('global_chat').doc(data.messageId).update({
                        telegramMsgId: json.telegramMsgId.toString(),
                        telegramChatId: json.chatId.toString()
                    });
                }
            } catch (e) {
                console.log('[BRIDGE] Could not store telegramMsgId:', e.message);
            }
        }

        return { ok: json.ok || false, telegramMsgId: json.telegramMsgId };
    } catch(e) {
        console.error('[BRIDGE] Error:', e.message);
        return { ok: false };
    }
});

// ===== SATS FAUCET - claimSats Cloud Function =====
exports.claimSats = functions.https.onCall(async (data, context) => {
    // 1. Must be authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const uid = context.auth.uid;
    const email = context.auth.token.email;
    const emailVerified = context.auth.token.email_verified;

    // 2. Must not be anonymous, must have verified email
    if (!email || !emailVerified) {
        return { success: false, error: 'Verified email required. Link and verify your email in Account settings.' };
    }

    // 3. NWC configuration check
    if (!FAUCET.NWC_URL) {
        console.error('[FAUCET] NWC_URL not configured');
        return { success: false, error: 'Faucet not configured. Contact admin.' };
    }

    // ---- Lightning Address path: resolve LNURL-pay server-side ----
    // If caller passes lightningAddress + amount instead of a pre-made invoice,
    // we fetch the BOLT11 for them so they don’t have to open their wallet.
    let invoice = (data.invoice || '').trim();
    const lnAddrRaw = (data.lightningAddress || '').trim();
    const lnAddrAmount = Math.floor(Number(data.amount) || 0); // sats

    if (lnAddrRaw && !invoice) {
        // Validate Lightning Address format
        if (!lnAddrRaw.includes('@') || lnAddrRaw.length < 5 || lnAddrRaw.length > 320) {
            return { success: false, error: 'Invalid Lightning Address format.' };
        }
        if (lnAddrAmount < FAUCET.MIN_WITHDRAWAL_SATS || lnAddrAmount > FAUCET.MAX_PER_CLAIM_SATS) {
            return { success: false, error: 'Amount must be between ' + FAUCET.MIN_WITHDRAWAL_SATS + ' and ' + FAUCET.MAX_PER_CLAIM_SATS + ' sats.' };
        }

        // SECURITY: SSRF prevention — validate the domain is a public internet hostname.
        // Blocks: localhost, 127.x, 10.x, 172.16-31.x, 169.254.x (link-local/AWS metadata),
        // 192.168.x, ::1, and any non-HTTPS scheme. Also disallows bare IPs entirely.
        const _lnDomainRaw = lnAddrRaw.split('@')[1] || '';
        const _lnDomain = _lnDomainRaw.split(':')[0].toLowerCase(); // strip port
        const _isPrivateHost = (
            _lnDomain === 'localhost' ||
            /^127\./.test(_lnDomain) ||
            /^10\./.test(_lnDomain) ||
            /^192\.168\./.test(_lnDomain) ||
            /^172\.(1[6-9]|2[0-9]|3[01])\./.test(_lnDomain) ||
            /^169\.254\./.test(_lnDomain) ||
            /^::1$/.test(_lnDomain) ||
            /^fd[0-9a-f]{2}:/i.test(_lnDomain) ||
            /^\d+\.\d+\.\d+\.\d+$/.test(_lnDomain) // reject bare IP addresses entirely
        );
        if (_isPrivateHost || !_lnDomain || _lnDomain.length < 3 || !_lnDomain.includes('.')) {
            console.error('[FAUCET] SSRF BLOCKED: domain=' + _lnDomain + ' uid=' + uid);
            return { success: false, error: 'Invalid Lightning Address domain.' };
        }

        // Resolve Lightning Address → LNURL-pay → BOLT11
        try {
            const nodeFetch = require('node-fetch');
            const [localPart, domain] = lnAddrRaw.split('@');
            const lnurlPayUrl = 'https://' + domain + '/.well-known/lnurlp/' + encodeURIComponent(localPart);
            const metaRes = await nodeFetch(lnurlPayUrl, { timeout: 8000, size: 65536 }); // 64KB max response
            if (!metaRes.ok) throw new Error('LNURL-pay metadata fetch failed (' + metaRes.status + ')');
            const meta = await metaRes.json();
            if (!meta.callback) throw new Error('No callback in LNURL-pay metadata');

            // SECURITY: SSRF prevention on callback URL — must be https:// on the same domain.
            // A malicious LNURL server could return a callback pointing to internal infra.
            let cbUrl;
            try {
                cbUrl = new URL(meta.callback);
            } catch(_) {
                throw new Error('Invalid callback URL in LNURL-pay response');
            }
            if (cbUrl.protocol !== 'https:') {
                throw new Error('Callback URL must use HTTPS');
            }
            // Callback domain must match the Lightning Address domain (prevents open redirect to internal)
            if (cbUrl.hostname.toLowerCase() !== domain.split(':')[0].toLowerCase()) {
                throw new Error('Callback URL domain mismatch (expected ' + domain + ')');
            }

            const msats = lnAddrAmount * 1000;
            if (meta.minSendable && msats < meta.minSendable) {
                throw new Error('Amount below wallet minimum (' + Math.ceil(meta.minSendable / 1000) + ' sats)');
            }
            if (meta.maxSendable && msats > meta.maxSendable) {
                throw new Error('Amount above wallet maximum (' + Math.floor(meta.maxSendable / 1000) + ' sats)');
            }
            const cbSep = meta.callback.includes('?') ? '&' : '?';
            const invoiceRes = await nodeFetch(meta.callback + cbSep + 'amount=' + msats, { timeout: 8000, size: 65536 }); // 64KB max
            if (!invoiceRes.ok) throw new Error('Invoice fetch failed (' + invoiceRes.status + ')');
            const invoiceData = await invoiceRes.json();
            if (!invoiceData.pr) throw new Error('No invoice returned by Lightning Address');
            invoice = invoiceData.pr;
            console.log('[FAUCET] Resolved Lightning Address ' + lnAddrRaw + ' → invoice for ' + lnAddrAmount + ' sats (callback domain: ' + cbUrl.hostname + ')');
        } catch (e) {
            console.error('[FAUCET] Lightning Address resolution failed:', e.message);
            return { success: false, error: 'Could not resolve Lightning Address: ' + (e.message || 'unknown error') };
        }
    }

    // 4. Validate invoice format
    if (!invoice || !invoice.toLowerCase().startsWith('lnbc')) {
        return { success: false, error: 'Invalid Lightning invoice. Must start with lnbc.' };
    }
    if (invoice.length < 50 || invoice.length > 2000) {
        return { success: false, error: 'Invalid Lightning invoice length.' };
    }

    // 5. Cryptographic BOLT11 decode (C4 fix - proper library, not regex)
    let decoded;
    try {
        decoded = bolt11.decode(invoice);
    } catch(e) {
        return { success: false, error: 'Invalid Lightning invoice format: ' + (e.message || 'decode failed') };
    }
    const amount = Math.floor((decoded.millisatoshis || 0) / 1000);
    if (!amount || amount <= 0) {
        return { success: false, error: 'Invoice has no amount or zero amount. Create an invoice for a specific amount.' };
    }

    if (amount < FAUCET.MIN_WITHDRAWAL_SATS) {
        return { success: false, error: 'Invoice is for ' + amount + ' sats. Minimum claim is ' + FAUCET.MIN_WITHDRAWAL_SATS + ' sats.' };
    }
    if (amount > FAUCET.MAX_PER_CLAIM_SATS) {
        return { success: false, error: 'Invoice is for ' + amount + ' sats. Maximum claim is ' + FAUCET.MAX_PER_CLAIM_SATS + ' sats.' };
    }

    // 6. Check invoice expiry
    if (decoded.timeExpireDate && decoded.timeExpireDate < Math.floor(Date.now() / 1000)) {
        return { success: false, error: 'Invoice has expired. Generate a fresh one.' };
    }

    // 7. Invoice replay protection - full invoice SHA-256 hash (C3 fix)
    const invoiceHash = require('crypto').createHash('sha256').update(invoice).digest('hex').substring(0, 32);
    const replayDoc = await db.collection('faucet_invoices').doc(invoiceHash).get();
    if (replayDoc.exists) {
        return { success: false, error: 'This invoice has already been used. Generate a new one.' };
    }

    // 5. Check account age FIRST (cheap check, fail fast)
    let userRecord;
    try {
        userRecord = await admin.auth().getUser(uid);
        const creationDate = new Date(userRecord.metadata.creationTime);
        const ageDays = Math.floor((Date.now() - creationDate.getTime()) / 86400000);
        if (ageDays < FAUCET.MIN_ACCOUNT_AGE_DAYS) {
            return { success: false, error: 'Account must be at least ' + FAUCET.MIN_ACCOUNT_AGE_DAYS + ' days old. Yours is ' + ageDays + ' days.' };
        }
    } catch(e) {
        console.error('[FAUCET] Could not verify account age:', e.message);
        return { success: false, error: 'Could not verify account age. Try again later.' };
    }

    // 6. Check kill switch before expensive operations
    const configDoc = await db.collection('faucet_config').doc('settings').get();
    if (configDoc.exists && configDoc.data().paused) {
        return { success: false, error: 'Sats faucet is temporarily paused.' };
    }

    // 6a. IP RATE LIMITING (Fix #6) - flag same IP claiming across multiple accounts
    const clientIP = (context.rawRequest && context.rawRequest.ip) || 'unknown';
    if (clientIP === 'unknown') {
        console.error('[FAUCET] Could not determine client IP for uid=' + uid);
        return { success: false, error: 'Could not verify request origin. Try again later.' };
    }
    {
        const ipRef = db.collection('faucet_ip_log').doc(clientIP.replace(/[./]/g, '_'));
        const ipDoc = await ipRef.get();
        if (ipDoc.exists) {
            const ipData = ipDoc.data();
            const ipUids = ipData.uids || [];
            // Flag if 3+ different UIDs claim from the same IP
            if (ipUids.length >= 3 && !ipUids.includes(uid)) {
                console.error('[FAUCET] IP ABUSE: ' + clientIP + ' used by ' + ipUids.length + ' accounts + new uid=' + uid);
                return { success: false, error: 'Unusual activity detected from this network. Contact support if this is an error.' };
            }
            // Check if same IP claimed in last 2 hours (across ANY account)
            const lastClaimTime = ipData.lastClaim ? (ipData.lastClaim.toDate ? ipData.lastClaim.toDate() : new Date(ipData.lastClaim)) : null;
            if (lastClaimTime && (Date.now() - lastClaimTime.getTime()) < 7200000 && ipData.lastUid !== uid) {
                console.error('[FAUCET] IP COOLDOWN: ' + clientIP + ' claimed by ' + ipData.lastUid + ' recently, now uid=' + uid);
                return { success: false, error: 'A claim was recently made from this network. Try again later.' };
            }
        }
        // Log this IP claim (after payment succeeds - moved to post-payment batch below)
    }

    // 6b. DEVICE FINGERPRINT CHECK (Mandatory - Fix M-NEW-12)
    const fingerprint = (data.fingerprint || '').trim();
    if (!fingerprint || fingerprint.length < 8) {
        console.warn('[FAUCET] FINGERPRINT MISSING: uid=' + uid);
        return { success: false, error: 'Device verification required.' };
    }

    const fpRef = db.collection('faucet_fingerprints').doc(fingerprint.substring(0, 64));
    const fpDoc = await fpRef.get();
    if (fpDoc.exists) {
        const fpData = fpDoc.data();
        const fpUids = fpData.uids || [];
        if (fpUids.length >= 2 && !fpUids.includes(uid)) {
            console.error('[FAUCET] FINGERPRINT ABUSE: fp=' + fingerprint.substring(0, 16) + ' used by ' + fpUids.length + ' accounts + uid=' + uid);
            return { success: false, error: 'This device has been used by multiple accounts. Each person may only claim from one account.' };
        }
    }

    // 7. ATOMIC TRANSACTION - All balance/limit checks + point deduction in one transaction
    //    This prevents race conditions from concurrent requests
    const today = new Date().toISOString().split('T')[0];
    const userRef = db.collection('users').doc(uid);
    const dailyRef = userRef.collection('sats_daily').doc(today);
    const globalRef = db.collection('faucet_stats').doc(today);
    // Server-only ledger - immune to client account-deletion (C-NEW-6 fix)
    // Firestore rules DENY all client reads/writes to this collection.
    const ledgerRef = db.collection('faucet_ledger').doc(uid);

    let transactionPassed = false;
    try {
        await db.runTransaction(async (t) => {
            const userDoc = await t.get(userRef);
            if (!userDoc.exists) throw new Error('User profile not found.');
            const user = userDoc.data();

            // SATS DISABLED CHECK - admin ban for farming/abuse
            if (user.satsDisabled === true) {
                throw new Error('Sats withdrawals are disabled on this account. Contact support if you believe this is an error.');
            }

            // L1: Check if a previous claim is still pending
            if (user._pendingClaim === true) {
                throw new Error('A previous claim is still processing. Try again in a minute.');
            }

            // Check channels read
            // Fix #4: Use visitedChannelsList (arrayUnion-only, tamper-resistant) instead of readChannels
            // Backfill: pre-fix users may have 0 visitedChannelsList but valid readChannels.
            // On first faucet attempt, migrate readChannels -> visitedChannelsList in this transaction.
            let visitedList = Array.isArray(user.visitedChannelsList) ? user.visitedChannelsList : [];
            if (visitedList.length < FAUCET.MIN_CHANNELS_READ) {
                const legacyRead = Array.isArray(user.readChannels) ? user.readChannels : [];
                if (legacyRead.length > visitedList.length) {
                    // Merge legacy client-tracked list into server-tracked list (dedup)
                    const merged = Array.from(new Set([].concat(visitedList, legacyRead.filter(function(c){ return typeof c === 'string' && c.length > 0 && c.length <= 100; }))));
                    t.update(userRef, { visitedChannelsList: merged });
                    visitedList = merged;
                }
            }
            const channelsRead = visitedList.length;
            if (channelsRead < FAUCET.MIN_CHANNELS_READ) {
                throw new Error('Must read at least ' + FAUCET.MIN_CHANNELS_READ + ' channels. You have read ' + channelsRead + '.');
            }

            // Check points balance.
            // Points are never deducted on earn; we track offset counters instead:
            //   pointsClaimed  — sats already withdrawn against these points
            //   pointsDonated  — points "spent" via donatePoints (same pool, can't overlap)
            // [VULN-4 FIX] Subtract pointsDonated so donated points can't also fund sats claims.
            const userPoints = user.points || 0;
            const pointsClaimed = user.pointsClaimed || 0;
            const pointsDonated = user.pointsDonated || 0;
            const availablePoints = userPoints - pointsClaimed - pointsDonated;
            const satsBalance = Math.floor(availablePoints / FAUCET.POINTS_PER_SAT);
            if (satsBalance < amount) {
                throw new Error('Insufficient unclaimed points. You have ' + satsBalance + ' sats worth of unclaimed points (' + availablePoints + ' pts).');
            }

            // Server-side points sanity check: max 500 pts/day × account age + 2100 (scholar)
            // Uses Firebase Auth metadata (immutable) - NOT client-writable Firestore field
            // Points sanity check - log suspicious but do NOT block claims.
            // All other rules (cooldown, lifetime cap, daily cap, min channels, min age)
            // still enforce. Phil: "as long as all rules are followed, allow it." (2026-04-25)
            {
                const authCreation = new Date(userRecord.metadata.creationTime);
                const accountDays = Math.max(1, Math.floor((Date.now() - authCreation.getTime()) / 86400000));
                const maxReasonablePoints = (accountDays * 500) + 2100;
                if (userPoints > maxReasonablePoints) {
                    console.error('[FAUCET] SUSPICIOUS (allowed): uid=' + uid + ' has ' + userPoints + ' pts but max reasonable=' + maxReasonablePoints + ' for ' + accountDays + ' day account (auth creation: ' + userRecord.metadata.creationTime + ')');
                }
            }

            // Read server-only ledger (survives account deletion) - C-NEW-6 fix
            const ledgerDoc = await t.get(ledgerRef);
            const ledger = ledgerDoc.exists ? ledgerDoc.data() : {};

            // [VULN-7 FIX] Check ledger ban BEFORE user-doc ban.
            // faucet_ledger is allow write: if false — clients can never clear this.
            // This defeats the delete+recreate bypass: even if the user deletes their
            // Firestore profile and recreates it (no satsDisabled field), the ledger
            // ban persists and blocks the claim. Both checks are enforced — either
            // banning mechanism alone is sufficient to block.
            if (ledger.banned === true) {
                throw new Error('Sats withdrawals are disabled on this account. Contact support if you believe this is an error.');
            }

            // Check lifetime cap - use MAX of user doc and ledger to handle both
            // pre-existing users (only have user.satsWithdrawn) and post-deletion
            // attackers (user doc reset, ledger intact).
            const userSatsWithdrawn = user.satsWithdrawn || 0;
            const ledgerSatsWithdrawn = ledger.satsWithdrawn || 0;
            const satsWithdrawn = Math.max(userSatsWithdrawn, ledgerSatsWithdrawn);
            if (satsWithdrawn + amount > FAUCET.MAX_LIFETIME_PER_USER_SATS) {
                const remaining = FAUCET.MAX_LIFETIME_PER_USER_SATS - satsWithdrawn;
                throw new Error('Lifetime cap reached. You can withdraw ' + remaining + ' more sats.');
            }

            // Check 24h cooldown - again use max(user, ledger)
            function _toDate(v) {
                if (!v) return null;
                if (v.toDate) return v.toDate();
                return new Date(v);
            }
            const userLastClaim = _toDate(user.lastSatsClaim);
            const ledgerLastClaim = _toDate(ledger.lastSatsClaim);
            let lastClaim = null;
            if (userLastClaim && ledgerLastClaim) {
                lastClaim = userLastClaim.getTime() > ledgerLastClaim.getTime() ? userLastClaim : ledgerLastClaim;
            } else {
                lastClaim = userLastClaim || ledgerLastClaim;
            }
            if (lastClaim) {
                const cooldownEnd = lastClaim.getTime() + (FAUCET.COOLDOWN_HOURS * 60 * 60 * 1000);
                if (Date.now() < cooldownEnd) {
                    const hoursLeft = Math.ceil((cooldownEnd - Date.now()) / 3600000);
                    throw new Error('Cooldown active. Try again in ~' + hoursLeft + ' hour(s).');
                }
            }

            // Check daily per-user cap
            const dailyDoc = await t.get(dailyRef);
            const dailyUsed = dailyDoc.exists ? (dailyDoc.data().amount || 0) : 0;
            if (dailyUsed + amount > FAUCET.MAX_DAILY_PER_USER_SATS) {
                const remaining = FAUCET.MAX_DAILY_PER_USER_SATS - dailyUsed;
                throw new Error('Daily limit reached. You can claim ' + remaining + ' more sats today.');
            }

            // Check global daily cap
            const globalDoc = await t.get(globalRef);
            const globalUsed = globalDoc.exists ? (globalDoc.data().totalPaid || 0) : 0;
            if (globalUsed + amount > FAUCET.GLOBAL_DAILY_MAX_SATS) {
                throw new Error('Daily faucet limit reached. Try again tomorrow.');
            }

            // ALL CHECKS PASSED - mark points as claimed (NEVER deduct points)
            // This locks the unclaimed balance so concurrent requests fail
            const pointsToClaim = amount * FAUCET.POINTS_PER_SAT;
            t.update(userRef, {
                pointsClaimed: admin.firestore.FieldValue.increment(pointsToClaim),
                satsWithdrawn: admin.firestore.FieldValue.increment(amount),
                lastSatsClaim: admin.firestore.FieldValue.serverTimestamp(),
                _pendingClaim: true // flag: payment in progress
            });

            // ALSO write to server-only ledger (C-NEW-6 fix). Using set+merge so
            // first-time users get a fresh doc, and increment so multi-claim adds up.
            t.set(ledgerRef, {
                satsWithdrawn: admin.firestore.FieldValue.increment(amount),
                lastSatsClaim: admin.firestore.FieldValue.serverTimestamp(),
                lastUid: uid,
                claimCount: admin.firestore.FieldValue.increment(1),
                firstClaim: ledgerDoc.exists ? (ledger.firstClaim || admin.firestore.FieldValue.serverTimestamp()) : admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            t.set(dailyRef, { amount: admin.firestore.FieldValue.increment(amount) }, { merge: true });
            t.set(globalRef, { totalPaid: admin.firestore.FieldValue.increment(amount), claimCount: admin.firestore.FieldValue.increment(1) }, { merge: true });
        });
        transactionPassed = true;
    } catch (e) {
        console.error('[FAUCET] Transaction failed:', e.message);
        return { success: false, error: e.message || 'Claim validation failed.' };
    }

    if (!transactionPassed) {
        return { success: false, error: 'Claim validation failed.' };
    }

    // 7. Check wallet balance floor
    let nwc;
    try {
        nwc = new NWCClient({ nostrWalletConnectUrl: FAUCET.NWC_URL });
        const balanceResult = await nwc.getBalance();
        const walletSats = Math.floor(balanceResult.balance / 1000);
        if (walletSats < FAUCET.WALLET_BALANCE_FLOOR_SATS) {
            // ROLLBACK: refund points since we already deducted
            await _rollbackClaim(uid, amount, today);
            return { success: false, error: 'Faucet is being refilled. Try again later.' };
        }
    } catch (e) {
        console.error('[FAUCET] Balance check failed:', e.message);
        await _rollbackClaim(uid, amount, today);
        return { success: false, error: 'Could not connect to payment wallet. Try again later.' };
    }

    // FINAL SAFETY CHECK - absolute hard cap before touching the wallet
    if (amount > 500) {
        console.error('[FAUCET] BLOCKED: amount ' + amount + ' exceeds hard cap of 500 sats for uid=' + uid);
        await _rollbackClaim(uid, amount, today);
        return { success: false, error: 'Claim exceeds maximum. Contact support.' };
    }

    // 9. PAY THE INVOICE via NWC
    try {
        const payResult = await nwc.payInvoice({ invoice: invoice });
        if (!payResult || !payResult.preimage) {
            await _rollbackClaim(uid, amount, today);
            return { success: false, error: 'Payment failed. Check your invoice and try again.' };
        }

        // 9. Payment succeeded - record withdrawal history, clear pending flag, mark invoice used
        const batch = db.batch();
        batch.update(userRef, { _pendingClaim: admin.firestore.FieldValue.delete() });
        batch.set(userRef.collection('sats_withdrawals').doc(), {
            amount: amount,
            pointsUsed: amount * FAUCET.POINTS_PER_SAT,
            invoice: invoice.substring(0, 50) + '...',
            preimage: payResult.preimage,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            uid: uid
        });
        // Mark invoice as used (replay protection)
        batch.set(db.collection('faucet_invoices').doc(invoiceHash), {
            uid: uid,
            amount: amount,
            ts: admin.firestore.FieldValue.serverTimestamp()
        });
        // Log IP for multi-account detection (Fix #6)
        if (clientIP !== 'unknown') {
            const ipDocRef = db.collection('faucet_ip_log').doc(clientIP.replace(/[./]/g, '_'));
            batch.set(ipDocRef, {
                lastClaim: admin.firestore.FieldValue.serverTimestamp(),
                lastUid: uid,
                uids: admin.firestore.FieldValue.arrayUnion(uid),
                claimCount: admin.firestore.FieldValue.increment(1)
            }, { merge: true });
        }
        // Log fingerprint for multi-account detection (Fix #3)
        if (fingerprint && fingerprint.length >= 8) {
            const fpDocRef = db.collection('faucet_fingerprints').doc(fingerprint.substring(0, 64));
            batch.set(fpDocRef, {
                lastClaim: admin.firestore.FieldValue.serverTimestamp(),
                lastUid: uid,
                uids: admin.firestore.FieldValue.arrayUnion(uid),
                claimCount: admin.firestore.FieldValue.increment(1)
            }, { merge: true });
        }
        await batch.commit();

        console.log('[FAUCET] Paid ' + amount + ' sats to ' + uid + ' (preimage: ' + payResult.preimage.substring(0, 16) + '...)');

        return {
            success: true,
            amount: amount,
            preimage: payResult.preimage,
            message: '⚡ ' + amount + ' sats sent to your wallet!'
        };
    } catch (e) {
        console.error('[FAUCET] Payment error:', e.message);
        // Payment failed - rollback the points deduction
        await _rollbackClaim(uid, amount, today);
        return { success: false, error: 'Payment failed: ' + (e.message || 'Unknown error') };
    }
});

// Rollback helper: refund points if payment fails after transaction
async function _rollbackClaim(uid, amount, today) {
    try {
        const pointsToRefund = amount * FAUCET.POINTS_PER_SAT;
        const batch = db.batch();
        batch.update(db.collection('users').doc(uid), {
            pointsClaimed: admin.firestore.FieldValue.increment(-pointsToRefund),
            satsWithdrawn: admin.firestore.FieldValue.increment(-amount),
            _pendingClaim: admin.firestore.FieldValue.delete()
        });
        // Also roll back the server-only ledger (C-NEW-6 fix)
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
        await batch.commit();
        console.log('[FAUCET] Rolled back ' + amount + ' sats for ' + uid);
    } catch (e) {
        console.error('[FAUCET] CRITICAL: Rollback failed for ' + uid + ', amount=' + amount + ':', e.message);
    }
}

// ===== SERVER-SIDE POINTS AWARD (Fix #1, #2, #5) =====
// All point awards go through this Cloud Function instead of direct Firestore writes
// Enforces daily cap server-side, eliminates localStorage bypass and console inflation
exports.awardPoints = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const uid = context.auth.uid;
    const actionKey = (data.actionKey || '').substring(0, 50);
    const action = (data.action || data.reason || '').substring(0, 100);
    const channelId = (data.channelId || '').substring(0, 100);
    const tickets = parseInt(data.tickets) || 0;
    const streakFreezes = parseInt(data.streakFreezes) || 0;
    // Badge ID for server-side dedup (optional - only sent for badge_earned actions)
    const badgeId = (data.badgeId || '').replace(/[^a-zA-Z0-9_\-]/g, '').substring(0, 60);

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
        first_purchase: 100,
        // Sats milestones
        sats_first: 25, sats_1k: 100, sats_5k: 250, sats_10k: 500, sats_21k: 2100,
        // Streaks
        streak_7: 50, streak_14: 75, streak_30: 150, streak_60: 400,
        streak_100: 1000, streak_200: 2100, streak_365: 5000,
        // Nacho story
        story_begun: 15, story_halfway: 50, story_complete: 150,
        // Trails
        trail_meadow: 200, trail_mountain: 400, trail_summit: 750, trail_all: 500,
        // FLEX aggregate badges
        flex_rookie: 25, flex_committed: 75, flex_athlete: 200, flex_legend: 1000, flex_all_once: 150,
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

// ── ACTION-BASED POINT VALIDATION ──
    // Server defines exact point values per action type. Client cannot choose amounts.
    const ACTION_POINTS = {
        'channel_read': 10,           // Open a new channel
        'channel_read_bonus': 15,     // Read for 30 seconds
        'read_time': 5,               // Periodic read time bonus
        'daily_visit': 5,             // Daily visit base
        'daily_visit_streak': 100,    // Streak bonus
        'explore_10': 50,             // 10 channels explored
        'explore_25': 50,             // 25% milestone
        'explore_50': 100,            // 50% milestone
        'explore_75': 200,            // 75% milestone
        'explore_100': 500,           // 100% milestone
        'daily_spin': 50,             // Max spin reward
        'quest_complete': 100,        // Perfect quest
        'quest_retry': 25,            // Quest retry
        'quest_partial': 50,          // Quest 3+ correct
        'scholar_cert': 2100,         // Scholar certification
        'badge_earned': 30000,        // Ceiling only — actual pts are overridden by BADGE_VALUES lookup below
        'pvp_victory': 50,            // PVP win (score-based, capped)
        'pvp_practice': 10,           // PVP practice correct
        'pvp_draw': 5,               // PVP draw
        'pvp_consolation': 25,        // PVP loss consolation
        'chat_message': 5,            // Global chat message
        'chat_streak_3': 10,          // 3-day chat streak
        'chat_streak_7': 25,          // 7-day chat streak
        'forum_post': 10,             // Forum post
        'forum_reply': 5,             // Forum reply
        'article_publish': 30,        // Publish article
        'article_read': 5,            // Read article
        'article_comment': 5,         // Comment on article
        'beats_upload': 50,           // Upload a song
        'beats_listen': 10,           // Listen to full track
        'beats_comment': 10,          // Comment on Beats
        'irl_host': 15,               // Host IRL event
        'prediction': 5,              // Make prediction
        'prediction_correct': 25,     // Correct prediction
        'welcome_bonus': 5,           // First visit
        'anon_merge': 500,            // Anonymous data merge (capped)
        'story_chapter': 15,          // Nacho story chapter
        'story_final': 50,            // Final story chapter
        'story_complete': 100,        // All story chapters
        'trail_chapter': 25,          // Trail chapter
        'trail_complete': 50,         // Trail completion
        'ticket_bonus': 5,            // Per-ticket bonus (tickets × 5)
        'streak_freeze': 0,           // Streak freeze only (no points)
        'tickets_only': 0,            // Tickets only (no points)
        'feedback': 5,                // Feedback bonus
        'tctv_watch_10m': 10,          // Timechain TV: 10 points per 10 minutes watched (cooldown enforced)
        'quiz_correct': 10,            // Nacho Mode quiz correct answer
        'trivia_correct': 50,          // Daily trivia correct answer
        'trivia_attempt': 10,          // Daily trivia attempt (wrong answer)
        'poll_vote': 50,               // Daily poll quest vote
        'flex_action': 15,             // Daily FLEX healthy action (one per action-id per day) — now 15 pts
        'combo_bonus': 250,            // Combo tier bonus (client specifies pts, capped at 250)
        'weekly_challenge_contrib': 0, // Weekly challenge contribution (no direct pts, just tracking)
        'daily_trifecta_ticket': 0,   // +1 ticket for completing daily trifecta (no direct pts)
        'nacho_chat_ticket': 0,       // +1 ticket for first Nacho message of the day
        'daily_chat_ticket': 0,       // +2 tickets for first global chat message of the day
        'dj_set_ticket': 0,           // +5 tickets for DJ set
        'beats_upload_ticket': 0,     // +10 tickets for beat upload
        'flashcard_ticket': 0,        // +5 tickets for flashcard deck complete
        'pvp_win_ticket': 0,          // +1 ticket for PvP win
        'raid_damage_ticket': 0,      // +N tickets for raid damage dealt
        'forum_post_ticket': 0,       // +1 ticket for forum post
        'marketplace_listing_ticket': 0, // +1 ticket for marketplace listing
        'irl_listing_ticket': 0,      // +1 ticket for IRL listing
        'strava_connect_ticket': 0,   // +5 tickets for Strava first connect (one-time)
        'tctv_watch_ticket': 0,       // +1 ticket per 15 min of TCTV
    };

    // Look up max allowed points for this action using keyword matching
    const actionLower = action.toLowerCase();
    const ACTION_KEYWORDS = {
        'channel_read': ['channel explored', 'channel_read', 'new channel'],
        'read_time': ['read_time', 'read time'],
        'daily_visit': ['daily visit', 'daily_visit'],
        'daily_visit_streak': ['streak!', 'day streak'],
        'explore_10': ['explore_10', 'explorer bonus', '10 channels'],
        'explore_25': ['explore_25', '25%'],
        'explore_50': ['explore_50', '50%'],
        'explore_75': ['explore_75', '75%'],
        'explore_100': ['explore_100', 'archive complete', '100%'],
        'daily_spin': ['daily spin', 'spin'],
        'quest_complete': ['quest:', 'quest_complete'],
        'scholar_cert': ['scholar', 'certification', '🎓'],
        'badge_earned': ['badge:', 'badge_earned'],
        'pvp_victory': ['pvp victory', 'pvp win'],
        'pvp_practice': ['pvp practice'],
        'pvp_draw': ['pvp draw'],
        'pvp_consolation': ['pvp consolation', 'pvp loss'],
        'chat_message': ['chat_message', 'global chat'],
        'chat_streak_3': ['chat_streak_3', '3-day chat'],
        'chat_streak_7': ['chat_streak_7', '7-day chat'],
        'forum_post': ['forum_post', 'forum post'],
        'forum_reply': ['forum_reply', 'forum reply'],
        'article_publish': ['article_publish', 'publish article'],
        'article_read': ['article_read', 'read article'],
        'article_comment': ['article_comment', 'article comment'],
        'beats_upload': ['beats_upload', 'upload'],
        'beats_listen': ['beats_listen', 'listened to', 'full track'],
        'beats_comment': ['beats_comment', 'comment on bitcoin beats'],
        'irl_host': ['irl_host', 'host irl'],
        'prediction': ['prediction'],
        'prediction_correct': ['prediction_correct', 'correct prediction'],
        'welcome_bonus': ['welcome bonus', 'welcome_bonus'],
        'anon_merge': ['anon_merge', 'anonymous progress'],
        'story_chapter': ['completed chapter', 'story_chapter'],
        'story_complete': ['completed nacho', 'story_complete'],
        'trail_chapter': ['trail_chapter', 'trail chapter'],
        'trail_complete': ['trail_complete'],
        'ticket_bonus': ['ticket', '🎟️'],
        'streak_freeze': ['streak freeze', 'streak_freeze', '🧊'],
        'tickets_only': ['tickets_only'],
        'feedback': ['feedback'],
        'tctv_watch_10m': ['tctv_watch', 'timechain tv', 'watching timechain'],
        'quiz_correct': ['quiz correct', 'quiz_correct', '🎮 quiz'],
        'trivia_correct': ['trivia quest correct', 'trivia_correct', '🧠 trivia quest correct'],
        'trivia_attempt': ['trivia quest attempt', 'trivia_attempt', '🧠 trivia quest attempt'],
        'poll_vote': ['poll quest vote', 'poll_vote', '📊 poll quest vote'],

        'flex_action': ['💪 flex:', '🎯 Daily Challenge:'],
        'combo_bonus': ['combo', '🔥 Trio Combo', '💥 MEGA COMBO', '🏆 LEGENDARY COMBO', '🎯 Daily 3 Complete'],
        'daily_trifecta_ticket': ['daily trifecta'],
        'nacho_chat_ticket': ['daily nacho chat'],
        'daily_chat_ticket': ['daily chat'],
        'dj_set_ticket': ['dj set'],
        'beats_upload_ticket': ['beat uploaded'],
        'flashcard_ticket': ['flashcard deck complete'],
        'pvp_win_ticket': ['pvp win'],
        'raid_damage_ticket': ['raid damage'],
        'forum_post_ticket': ['forum post'],
        'marketplace_listing_ticket': ['marketplace listing'],
        'irl_listing_ticket': ['irl listing'],
        'strava_connect_ticket': ['strava connect'],
        'tctv_watch_ticket': ['tctv watch'],
    };

    let pts = 0;
    let matchedAction = null;

    // Priority 1: Explicit actionKey (exact enum match - not gameable)
    if (actionKey && ACTION_POINTS.hasOwnProperty(actionKey)) {
        matchedAction = actionKey;
        pts = ACTION_POINTS[actionKey];
    }

    // Priority 2: Keyword matching (backward compat - will be deprecated)
    if (!matchedAction) {
        for (const [key, keywords] of Object.entries(ACTION_KEYWORDS)) {
            for (const kw of keywords) {
                if (actionLower.includes(kw.toLowerCase())) {
                    pts = ACTION_POINTS[key];
                    matchedAction = key;
                    break;
                }
            }
            if (matchedAction) break;
        }
    }

    // Reject unknown actions - no backward-compat fallback
    if (!matchedAction) {
        return { success: false, error: 'Unknown action', awarded: 0 };
    }

    // If client sent explicit pts, cap at the action max
    if (data.pts !== undefined && data.pts !== null) {
        const requestedPts = parseInt(data.pts);
        if (!isNaN(requestedPts) && requestedPts >= 0) {
            pts = Math.min(requestedPts, pts);
        }
    }

    // For badge_earned: override pts from server catalog; reject unknown badges entirely.
    // This closes the money-printer exploit: previously any badgeId minted the full
    // 21,000-pt ceiling. Now pts are always server-authoritative and unknown badges
    // are rejected rather than silently accepted.
    let badgeKnown = false;
    if (matchedAction === 'badge_earned') {
        if (!badgeId || !Object.prototype.hasOwnProperty.call(BADGE_VALUES, badgeId)) {
            console.warn('[awardPoints] badge_earned rejected: unknown badgeId:', badgeId, 'uid:', uid);
            return { success: false, error: 'Unknown badge' };
        }
        pts = BADGE_VALUES[badgeId]; // server value always wins
        badgeKnown = true;
    }

    const absMax = (matchedAction === 'badge_earned') ? 100000 : 2200;
    if (pts < 0 || pts > absMax) {
        return { success: false, error: 'Invalid points amount' };
    }
    if (pts === 0 && !tickets && !streakFreezes && !channelId) {
        return { success: false, error: 'Nothing to award' };
    }

    const reason = action;

    // ── ATOMIC UPDATES ──
    const DAILY_CAP = 500;
    const today = new Date().toISOString().split('T')[0]; // UTC midnight — kept for raw audit logs only
    const offsetToday = getOffsetDateKey(); // 5 AM UTC — single source of truth for all daily gates
    const userRef = db.collection('users').doc(uid);
    const dailyPtsRef = userRef.collection('daily_points').doc(offsetToday);

    // ACTION COOLDOWN: Atomic read-then-write (Fix M-NEW-13)
    const ACTION_COOLDOWNS = {
        'chat_message': 3000,
        'forum_post': 60000,
        'forum_reply': 10000,
        'beats_comment': 10000,
        'article_comment': 10000,
        'tctv_watch_10m': 600000, // 10 minutes (Fix: server-side verification)
    };
    const cooldownRef = (matchedAction && ACTION_COOLDOWNS[matchedAction])
        ? db.collection('action_cooldowns').doc(uid + '_' + matchedAction)
        : null;

    // DAILY ACTION COUNT LIMIT: Cap certain actions per UTC day independent of point cap.
    // (Empty by default - beats_upload abuse is addressed by the 15s minimum duration
    // gate in Firestore rules + client, not here, so albums of many short tracks work.)
    const ACTION_DAILY_LIMITS = {};
    const dailyActionRef = (matchedAction && ACTION_DAILY_LIMITS[matchedAction])
        ? userRef.collection('daily_action_counts').doc(today + '_' + matchedAction)
        : null;

    let transactionResult = null;
    try {
        transactionResult = await db.runTransaction(async (t) => {
            // ── PHASE 1: ALL READS (Firestore requires reads before writes) ──

            // Pre-compute all ref keys we may need to read
            const DAILY_TICKET_ACTIONS = [
                'daily_trifecta_ticket', 'nacho_chat_ticket', 'daily_chat_ticket',
                'pvp_win_ticket', 'flashcard_ticket',
                'forum_post_ticket', 'marketplace_listing_ticket', 'irl_listing_ticket',
                'tctv_watch_ticket',
            ];
            const flexId = matchedAction === 'flex_action'
                ? (data.flexActionId || '').replace(/[^a-z0-9_]/g, '').substring(0, 30)
                : null;
            const comboTier = matchedAction === 'combo_bonus'
                ? (data.comboTier || '').replace(/[^a-z0-9_]/g, '').substring(0, 20)
                : null;

            const badgeAwardRef = badgeKnown ? userRef.collection('badge_awards').doc(badgeId) : null;
            const triviaRef = (matchedAction === 'trivia_correct' || matchedAction === 'trivia_attempt')
                ? userRef.collection('daily_action_counts').doc(offsetToday + '_trivia') : null;
            const pollRef = matchedAction === 'poll_vote'
                ? userRef.collection('daily_action_counts').doc(offsetToday + '_poll_vote') : null;
            const dtRef = DAILY_TICKET_ACTIONS.includes(matchedAction)
                ? userRef.collection('daily_action_counts').doc(offsetToday + '_' + matchedAction) : null;
            const stravaRef = matchedAction === 'strava_connect_ticket'
                ? userRef.collection('lifetime_awards').doc('strava_connect') : null;
            const countedRef = (matchedAction === 'dj_set_ticket' || matchedAction === 'beats_upload_ticket' || matchedAction === 'raid_damage_ticket')
                ? userRef.collection('daily_action_counts').doc(today + '_' + matchedAction) : null;
            const flexRef = flexId ? userRef.collection('daily_action_counts').doc(today + '_flex_' + flexId) : null;
            const comboRef = comboTier ? userRef.collection('daily_action_counts').doc(today + '_combo_' + comboTier) : null;

            // Execute all reads in parallel
            const readPromises = [
                cooldownRef ? t.get(cooldownRef) : Promise.resolve(null),
                badgeAwardRef ? t.get(badgeAwardRef) : Promise.resolve(null),
                triviaRef ? t.get(triviaRef) : Promise.resolve(null),
                pollRef ? t.get(pollRef) : Promise.resolve(null),
                dtRef ? t.get(dtRef) : Promise.resolve(null),
                stravaRef ? t.get(stravaRef) : Promise.resolve(null),
                countedRef ? t.get(countedRef) : Promise.resolve(null),
                flexRef ? t.get(flexRef) : Promise.resolve(null),
                comboRef ? t.get(comboRef) : Promise.resolve(null),
                dailyActionRef ? t.get(dailyActionRef) : Promise.resolve(null),
                t.get(userRef),
                t.get(dailyPtsRef),
            ];
            const [
                cooldownDoc, badgeAwardDoc, triviaDoc, pollDoc, dtDoc,
                stravaDoc, countedDoc, flexDoc, comboDoc,
                dailyActionDoc, userDoc, dailyDoc
            ] = await Promise.all(readPromises);

            // ── PHASE 2: ALL VALIDATION (throws abort transaction before any writes) ──

            // 1. Cooldown check
            if (cooldownDoc && cooldownDoc.exists) {
                const lastAction = cooldownDoc.data().ts;
                const lastTime = lastAction ? (lastAction.toDate ? lastAction.toDate() : new Date(lastAction)) : null;
                const cooldownMs = ACTION_COOLDOWNS[matchedAction];
                if (lastTime && (Date.now() - lastTime.getTime()) < cooldownMs) {
                    throw new Error('TOO_FAST');
                }
            }

            // 1a. Badge dedup
            if (badgeAwardDoc && badgeAwardDoc.exists) {
                throw new Error('BADGE_ALREADY_AWARDED:' + badgeId);
            }

            // 1c. Daily dedup for trivia
            if (triviaDoc && triviaDoc.exists) {
                throw new Error('ALREADY_CLAIMED_TODAY:trivia');
            }
            // Daily dedup for poll
            if (pollDoc && pollDoc.exists) {
                throw new Error('ALREADY_CLAIMED_TODAY:poll');
            }
            // Daily dedup for single-ticket-per-day
            if (dtDoc && dtDoc.exists) {
                throw new Error('ALREADY_CLAIMED_TODAY:' + matchedAction);
            }
            // strava one-time check
            if (stravaDoc && stravaDoc.exists) {
                throw new Error('ALREADY_AWARDED:strava_connect');
            }
            // dj_set / beats_upload / raid_damage daily max
            if (countedDoc) {
                const currentCount = countedDoc.exists ? (countedDoc.data().count || 0) : 0;
                const MAX = matchedAction === 'raid_damage_ticket' ? 50 : 10;
                if (currentCount >= MAX) {
                    throw new Error('DAILY_LIMIT_REACHED:' + matchedAction);
                }
            }
            // flex dedup
            if (matchedAction === 'flex_action') {
                if (!flexId) throw new Error('FLEX_MISSING_ACTION_ID');
                if (flexDoc && flexDoc.exists) throw new Error('ALREADY_CLAIMED_TODAY:flex_' + flexId);
            }
            // combo dedup
            if (matchedAction === 'combo_bonus') {
                if (!comboTier) throw new Error('COMBO_MISSING_TIER');
                if (comboDoc && comboDoc.exists) throw new Error('ALREADY_CLAIMED_TODAY:combo_' + comboTier);
            }
            // 1b. Per-day action count anti-spam
            let dailyActionUsed = 0;
            if (dailyActionDoc && dailyActionDoc.exists) {
                dailyActionUsed = dailyActionDoc.data().count || 0;
                const limit = ACTION_DAILY_LIMITS[matchedAction];
                if (limit && dailyActionUsed >= limit) {
                    throw new Error('DAILY_ACTION_LIMIT:' + matchedAction + ':' + limit);
                }
            }

            if (!userDoc.exists) throw new Error('User not found');
            const userData = userDoc.data();

            // 2. Throttle for Daily Tickets
            if (matchedAction === 'daily_tickets' || (action && action.includes('Daily tickets'))) {
                if (userData.lastTicketDate === today) {
                    throw new Error('ALREADY_CLAIMED_TODAY');
                }
            }

            // 3. Daily cap
            const dailyUsed = dailyDoc && dailyDoc.exists ? (dailyDoc.data().total || 0) : 0;

            // 3a. OVERFLOW ROLLOVER (rebuilt 2026-04-22 per Phil)
            // Users who exceed 500 pts/day now bank the excess in `pendingOverflow`
            // and redeem up to 500 of it on their next active day. This:
            //   - stops silently dropping points that honest users earned
            //   - still respects the anti-abuse daily cap (max 500 redeemed per day)
            //   - is server-authoritative (field is blocked from client writes)
            const OVERFLOW_REDEEM_CAP = DAILY_CAP; // max overflow that can hit the balance on a single day
            const pendingOverflow = userData.pendingOverflow || 0;
            const lastOverflowDate = userData.lastOverflowDate || null;

            // Redeem yesterday's (or older) overflow into today's balance FIRST,
            // before counting today's new award against the cap. Redemption itself
            // bypasses the cap check (those points were already earned legitimately
            // on a prior day) but is capped at 500/day so a huge backlog pays out
            // over multiple days instead of all at once.
            let overflowRedeemed = 0;
            let pendingOverflowAfter = pendingOverflow;
            if (pendingOverflow > 0 && lastOverflowDate && lastOverflowDate !== offsetToday) {
                overflowRedeemed = Math.min(pendingOverflow, OVERFLOW_REDEEM_CAP);
                pendingOverflowAfter = pendingOverflow - overflowRedeemed;
            }

            // Compute today's award against the daily cap. Any excess is added to
            // pendingOverflow for a future day.
            // EXCEPTION: badge_earned is a one-time lifetime award - always awarded in full,
            // never capped or deferred to overflow. A 21,000-pt badge should land immediately.
            let awarded = 0;
            let capped = false;
            let overflowAdded = 0;
            if (pts > 0) {
                if (badgeKnown) {
                    // Known badges bypass the daily cap entirely - one-time lifetime award
                    // (badgeKnown is only true when badgeId is in BADGE_VALUES catalog)
                    awarded = pts;
                } else if (dailyUsed < DAILY_CAP) {
                    awarded = pts;
                    if (dailyUsed + pts > DAILY_CAP) {
                        awarded = DAILY_CAP - dailyUsed;
                        overflowAdded = pts - awarded;
                    }
                    if (awarded < 0) awarded = 0;
                } else {
                    // Already at cap - entire award goes to overflow
                    overflowAdded = pts;
                }
                capped = !badgeKnown && (dailyUsed + awarded >= DAILY_CAP);
            }

            // 4. Build Atomic Update - channel tracking is a visit record (not a reward),
            // so it happens regardless of whether the daily points cap is hit.
            const userUpdate = {};

            // Record channel read server-side (tamper-resistant via arrayUnion)
            // Used by faucet eligibility check (MIN_CHANNELS_READ).
            // MUST run even when capped, otherwise users who hit the cap before
            // reading 10 channels can never become faucet-eligible.
            let channelTracked = false;
            if (channelId && channelId.length > 0 && channelId.length <= 100) {
                userUpdate.visitedChannelsList = admin.firestore.FieldValue.arrayUnion(channelId);
                // channelsVisited is a display counter - only bump on first read of this channel
                const currentList = Array.isArray(userData.visitedChannelsList) ? userData.visitedChannelsList : [];
                if (currentList.indexOf(channelId) === -1) {
                    userUpdate.channelsVisited = admin.firestore.FieldValue.increment(1);
                }
                channelTracked = true;
            }

            // Points/tickets/freezes - award today's legitimate portion PLUS any
            // overflow we're redeeming from prior days.
            const totalPointsOut = awarded + overflowRedeemed;
            if (totalPointsOut > 0) {
                userUpdate.points = admin.firestore.FieldValue.increment(totalPointsOut);
                // Weekly/monthly XP for leaderboard periods (only awarded points, not overflow redemption)
                if (awarded > 0) {
                    userUpdate.weeklyXP = admin.firestore.FieldValue.increment(awarded);
                    userUpdate.monthlyXP = admin.firestore.FieldValue.increment(awarded);
                }
                if (tickets && awarded > 0) userUpdate.orangeTickets = admin.firestore.FieldValue.increment(tickets);
                if (streakFreezes && awarded > 0) userUpdate.streakFreezes = admin.firestore.FieldValue.increment(streakFreezes);
                // Marks daily tickets as used (only if actually awarded)
                if (matchedAction === 'daily_tickets' || (action && action.includes('Daily tickets'))) {
                    userUpdate.lastTicketDate = today;
                }
            }

            // Update overflow bank. Net change = new overflow added today minus what we redeemed.
            if (overflowAdded > 0 || overflowRedeemed > 0) {
                userUpdate.pendingOverflow = pendingOverflowAfter + overflowAdded;
                userUpdate.lastOverflowDate = offsetToday;
            }

            // ── PHASE 3: ALL WRITES ──

            // Dedup stamps (badge, trivia, poll, tickets, strava, counted, flex, combo)
            if (badgeAwardRef) {
                t.set(badgeAwardRef, { awardedAt: admin.firestore.FieldValue.serverTimestamp(), action });
                t.update(userRef, { visibleBadges: admin.firestore.FieldValue.arrayUnion(badgeId) });
            }
            if (triviaRef) {
                t.set(triviaRef, { awardedAt: admin.firestore.FieldValue.serverTimestamp(), action: matchedAction });
            }
            if (pollRef) {
                t.set(pollRef, { awardedAt: admin.firestore.FieldValue.serverTimestamp(), action: matchedAction });
            }
            if (dtRef) {
                t.set(dtRef, { awardedAt: admin.firestore.FieldValue.serverTimestamp(), action: matchedAction });
            }
            if (stravaRef) {
                t.set(stravaRef, { awardedAt: admin.firestore.FieldValue.serverTimestamp() });
            }
            if (countedRef) {
                const currentCount = countedDoc && countedDoc.exists ? (countedDoc.data().count || 0) : 0;
                t.set(countedRef, { count: currentCount + 1, lastAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            }
            if (flexRef) {
                t.set(flexRef, { awardedAt: admin.firestore.FieldValue.serverTimestamp(), action: 'flex_action', flexId });
            }
            if (comboRef) {
                t.set(comboRef, { awardedAt: admin.firestore.FieldValue.serverTimestamp(), action: 'combo_bonus', comboTier });
            }

            // Write user doc if we have anything to write (channel visit and/or points)
            if (Object.keys(userUpdate).length > 0) {
                t.update(userRef, userUpdate);
            }

            // Daily points tracker bumps by everything that counted against today's cap.
            // Overflow redemption does NOT count against the cap (paying out previously-earned
            // points), so we only track the `awarded` portion.
            if (awarded > 0) {
                t.set(dailyPtsRef, { total: dailyUsed + awarded, lastUpdated: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            }

            // Cooldown stamp only when points were awarded (so capped calls don't burn cooldown)
            if (cooldownRef && (awarded > 0 || overflowAdded > 0)) {
                t.set(cooldownRef, { ts: admin.firestore.FieldValue.serverTimestamp() });
            }

            // Per-day action count - increment even when points hit daily cap
            // (so 5-upload hard limit applies regardless of point balance)
            if (dailyActionRef) {
                t.set(dailyActionRef, {
                    count: admin.firestore.FieldValue.increment(1),
                    lastAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }

            return {
                awarded: awarded,
                capped,
                dailyUsed: dailyUsed + awarded,
                overflowAdded,
                overflowRedeemed,
                pendingOverflow: pendingOverflowAfter + overflowAdded,
                channelTracked: channelTracked
            };
        });
    } catch (e) {
        if (e.message === 'TOO_FAST') {
            return { success: false, error: 'Too fast - wait a moment', cooldown: true };
        }
        if (e.message && e.message.startsWith('BADGE_ALREADY_AWARDED:')) {
            return { success: false, error: 'Badge already awarded', badgeDuplicate: true };
        }
        if (e.message && e.message.startsWith('DAILY_ACTION_LIMIT:')) {
            const parts = e.message.split(':');
            const limit = parts[2];
            return { success: false, error: 'Daily limit reached for this action (max ' + limit + '/day). Try again tomorrow.', dailyActionCapped: true };
        }
        if (e.message && e.message.startsWith('ALREADY_CLAIMED_TODAY')) {
            return { success: false, error: 'Daily tickets already claimed today.', dailyActionCapped: true };
        }
        console.error('[AWARD_POINTS_TRANS_ERR]', e);
        return { success: false, error: e.message || 'Internal error' };
    }

    // (dead-code block below removed 2026-04-16 - was a leftover from a pre-refactor commit that prevented Cloud Functions deploys)
});

// ===== FAUCET ADMIN - getFaucetStats =====
exports.getFaucetStats = functions.https.onCall(async (data, context) => {
    if (!context.auth || ['needcreations@gmail.com','info.603btc@gmail.com','najemchris8@gmail.com'].indexOf(context.auth.token.email) === -1) {
        throw new functions.https.HttpsError('permission-denied', 'Admin only');
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

    return {
        today: statsDoc.exists ? statsDoc.data() : { totalPaid: 0, claimCount: 0 },
        paused: configDoc.exists ? !!configDoc.data().paused : false,
        walletBalance: walletBalance,
        limits: FAUCET
    };
});

// ===== FAUCET ADMIN - toggleFaucet =====
exports.toggleFaucet = functions.https.onCall(async (data, context) => {
    if (!context.auth || ['needcreations@gmail.com','info.603btc@gmail.com','najemchris8@gmail.com'].indexOf(context.auth.token.email) === -1) {
        throw new functions.https.HttpsError('permission-denied', 'Admin only');
    }
    const paused = !!data.paused;
    await db.collection('faucet_config').doc('settings').set({ paused: paused }, { merge: true });
    return { success: true, paused: paused };
});

// ===== ONE-TIME: Backfill bestStreak for all users =====
exports.backfillBestStreak = functions.https.onCall(async (data, context) => {
    if (!context.auth || ['needcreations@gmail.com','info.603btc@gmail.com','najemchris8@gmail.com'].indexOf(context.auth.token.email) === -1) {
        throw new functions.https.HttpsError('permission-denied', 'Admin only');
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
exports.resolvePredictions = onSchedule({ schedule: 'every 6 hours', timeZone: 'UTC' }, async (event) => {
    const snap = await db.collection('active_predictions').where('resolved', '==', false).get();
    if (snap.empty) return;

    const now = Date.now();
    const batch = db.batch();
    let resolved = 0;
    let correct = 0;
    let total = 0;

    // Fetch current BTC price
    let currentPrice = 0;
    try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        const data = await res.json();
        if (data && data.bitcoin && data.bitcoin.usd) currentPrice = data.bitcoin.usd;
    } catch(e) {
        console.error('Failed to fetch BTC price:', e);
        return;
    }
    if (!currentPrice) return;

    snap.forEach(doc => {
        const pred = doc.data();
        // Only resolve after 24 hours (prediction window)
        if (now - pred.time < 24 * 60 * 60 * 1000) return;

        const diff = currentPrice - pred.price;
        const isCorrect = (pred.direction === 'up' && diff > 0) || (pred.direction === 'down' && diff < 0);

        // Update user's prediction stats
        const userRef = db.collection('users').doc(pred.uid);
        const inc = admin.firestore.FieldValue.increment;
        const userUpdate = {
            'predictions.total': inc(1),
            'predictions.lastResolved': now
        };
        if (isCorrect) {
            userUpdate['predictions.correct'] = inc(1);
        }
        batch.set(userRef, userUpdate, { merge: true });

        // Delete the active prediction
        batch.delete(doc.ref);

        if (isCorrect) correct++;
        total++;
        resolved++;
    });

    // Update global stats
    if (total > 0) {
        const globalRef = db.collection('stats').doc('predictions');
        const inc = admin.firestore.FieldValue.increment;
        const globalUpdate = { total: inc(total) };
        if (correct > 0) globalUpdate.correct = inc(correct);
        batch.set(globalRef, globalUpdate, { merge: true });
    }

    if (resolved > 0) await batch.commit();
    console.log(`Resolved ${resolved} predictions: ${correct}/${total} correct. BTC price: $${currentPrice}`);
});

// ---- One-time backfill global community stats ----
exports.backfillGlobalStats = functions.https.onCall(async (data, context) => {
    // Admin only
    if (!context.auth || (['needcreations@gmail.com','info.603btc@gmail.com','najemchris8@gmail.com'].indexOf(context.auth.token.email) === -1)) {
        throw new functions.https.HttpsError('permission-denied', 'Admin only');
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
exports.recordDailyVisit = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    if (context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functions.https.HttpsError('permission-denied', 'Sign in required');
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
            }

            t.update(userRef, updateData);

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

        return { success: true, ...result };
    } catch (e) {
        console.error('[VISIT] recordDailyVisit failed for ' + uid + ':', e.message);
        return { success: false, error: e.message || 'Visit recording failed' };
    }
});

// ---- Poll Vote (server-side with IP + fingerprint rate limiting) ----
exports.pollVote = functions.https.onCall(async (data, context) => {
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

        if (ipCount >= MAX_PER_DAY) throw new functions.https.HttpsError('resource-exhausted', 'Daily IP limit reached');
        if (fpCount >= MAX_PER_DAY) throw new functions.https.HttpsError('resource-exhausted', 'Daily device limit reached');

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

// ---- PVP Answer Submission (server-side validation) ----
exports.pvpSubmitAnswer = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');

    const { matchId, questionIndex, answerIndex } = data || {};
    if (!matchId || typeof questionIndex !== 'number' || typeof answerIndex !== 'number') {
        throw new functions.https.HttpsError('invalid-argument', 'Missing matchId, questionIndex, or answerIndex');
    }
    if (questionIndex < 0 || questionIndex > 4 || answerIndex < -1 || answerIndex > 3) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid question or answer index');
    }

    const uid = context.auth.uid;
    const matchRef = db.collection('pvp_matches').doc(matchId);

    const result = await db.runTransaction(async (tx) => {
        const matchDoc = await tx.get(matchRef);
        if (!matchDoc.exists) throw new functions.https.HttpsError('not-found', 'Match not found');

        const match = matchDoc.data();
        if (match.status !== 'active') throw new functions.https.HttpsError('failed-precondition', 'Match not active');
        if (match.currentQ !== questionIndex) throw new functions.https.HttpsError('failed-precondition', 'Wrong question index');

        // Determine which player this is
        let myKey, oppKey;
        if (match.player1.uid === uid) { myKey = 'player1'; oppKey = 'player2'; }
        else if (match.player2.uid === uid) { myKey = 'player2'; oppKey = 'player1'; }
        else throw new functions.https.HttpsError('permission-denied', 'Not a player in this match');

        const myAnswers = match[myKey].answers || [];
        if (myAnswers.length > questionIndex) {
            return { alreadyAnswered: true }; // Idempotent
        }

        // Server validates correctness from the stored questions
        const question = match.questions[questionIndex];
        if (!question) throw new functions.https.HttpsError('internal', 'Question not found');

        // Read answer key from server-only collection
        // The key is written by pvpStoreAnswerKey (for client-created matches) or
        // pvpCreateMatch (for CF-created matches). No fallback to the match doc —
        // that field is intentionally stripped (vuln-3 fix).
        const keyDoc = await tx.get(db.collection('pvp_answer_keys').doc(matchId));
        if (!keyDoc.exists) {
            // Key not yet stored (race: player 2 created match and immediately answered
            // before pvpStoreAnswerKey CF completed). Reject — client should retry.
            throw new functions.https.HttpsError('failed-precondition', 'Answer key not ready — please try again');
        }
        const keyEntry = keyDoc.data().keys && keyDoc.data().keys.find(k => k.questionIndex === questionIndex);
        if (!keyEntry || typeof keyEntry.correct !== 'number') {
            throw new functions.https.HttpsError('internal', 'Answer key missing for this question');
        }
        const correctAnswer = keyEntry.correct;

        const isCorrect = answerIndex === correctAnswer;
        const answerObj = {
            selected: answerIndex,
            correct: isCorrect,
            answeredAt: new Date().toISOString(),
            won: false
        };

        const newMyAnswers = myAnswers.slice();
        newMyAnswers.push(answerObj);

        const oppAnswers = match[oppKey].answers || [];
        const update = {};
        update[myKey + '.answers'] = newMyAnswers;

        // If both have answered this question, resolve the round
        if (oppAnswers.length > questionIndex) {
            const oppAnswer = oppAnswers[questionIndex];
            const myCorrect = isCorrect;
            const oppCorrect = oppAnswer.correct;

            if (myCorrect && !oppCorrect) {
                // I win this round
                newMyAnswers[questionIndex] = Object.assign({}, answerObj, { won: true });
                update[myKey + '.answers'] = newMyAnswers;
                update[myKey + '.score'] = (match[myKey].score || 0) + 10;
                update[myKey + '.correct'] = (match[myKey].correct || 0) + 1;
                update.questionWinner = myKey;
            } else if (!myCorrect && oppCorrect) {
                // Opponent wins this round
                const newOppAnswers = oppAnswers.slice();
                newOppAnswers[questionIndex] = Object.assign({}, oppAnswer, { won: true });
                update[oppKey + '.answers'] = newOppAnswers;
                update[oppKey + '.score'] = (match[oppKey].score || 0) + 10;
                update[oppKey + '.correct'] = (match[oppKey].correct || 0) + 1;
                update.questionWinner = oppKey;
            } else if (myCorrect && oppCorrect) {
                // Both correct - second answerer wins (already answered = opponent was first)
                const newOppAnswers = oppAnswers.slice();
                newOppAnswers[questionIndex] = Object.assign({}, oppAnswer, { won: true });
                update[oppKey + '.answers'] = newOppAnswers;
                update[oppKey + '.score'] = (match[oppKey].score || 0) + 10;
                update[oppKey + '.correct'] = (match[oppKey].correct || 0) + 1;
                update.questionWinner = oppKey;
            } else {
                // Both wrong - reroll
                update.questionWinner = 'reroll';
            }

            // Count completed rounds to check if match is finished
            let completedRounds = 0;
            for (let i = 0; i <= questionIndex; i++) {
                const a1 = (i === questionIndex ? newMyAnswers : (match[myKey].answers || []))[i];
                const a2 = (i === questionIndex ? (update[oppKey + '.answers'] || oppAnswers) : oppAnswers)[i];
                if (a1 && a2 && (a1.won || a2.won)) completedRounds++;
            }
            update.status = completedRounds >= 5 ? 'finished' : 'question_result';

            // If match finished, update PVP stats server-side
            if (update.status === 'finished') {
                // Count wins for each player
                const finalMyAnswers = update[myKey + '.answers'] || match[myKey].answers || [];
                const finalOppAnswers = update[oppKey + '.answers'] || match[oppKey].answers || [];
                let myWins = 0, oppWins = 0;
                for (let r = 0; r < 5; r++) {
                    if (finalMyAnswers[r] && finalMyAnswers[r].won) myWins++;
                    if (finalOppAnswers[r] && finalOppAnswers[r].won) oppWins++;
                }
                // Update winner/loser stats
                const myUidFinal = match[myKey].uid;
                const oppUidFinal = match[oppKey].uid;
                if (myWins > oppWins) {
                    tx.update(db.collection('users').doc(myUidFinal), { pvpWins: admin.firestore.FieldValue.increment(1) });
                    tx.update(db.collection('users').doc(oppUidFinal), { pvpLosses: admin.firestore.FieldValue.increment(1) });
                } else if (oppWins > myWins) {
                    tx.update(db.collection('users').doc(oppUidFinal), { pvpWins: admin.firestore.FieldValue.increment(1) });
                    tx.update(db.collection('users').doc(myUidFinal), { pvpLosses: admin.firestore.FieldValue.increment(1) });
                }
                // Draw: no stat changes
            }
        }

        tx.update(matchRef, update);
        return { success: true, correct: isCorrect, isCorrect, correctIndex: correctAnswer };
    });

    return result;
});

// ---- Daily Spin (server-side validation + reward) ----
exports.dailySpin = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    if (context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functions.https.HttpsError('permission-denied', 'Anonymous users cannot spin');
    }

    const uid = context.auth.uid;
    const today = new Date().toISOString().split('T')[0];
    const userRef = db.collection('users').doc(uid);

    // Spin outcomes with weights (server-determined)
    const outcomes = [
        { label: '🎟️ 1 Ticket',     pts: 0,  tickets: 1,  freezes: 0, closet: false, rare: false, weight: 25 },
        { label: '🎟️ 2 Tickets',    pts: 0,  tickets: 2,  freezes: 0, closet: false, rare: false, weight: 22 },
        { label: '⭐ 10 pts',        pts: 10, tickets: 0,  freezes: 0, closet: false, rare: false, weight: 18 },
        { label: '🎟️ 3 Tickets',    pts: 0,  tickets: 3,  freezes: 0, closet: false, rare: false, weight: 12 },
        { label: '⭐ 25 pts',        pts: 25, tickets: 0,  freezes: 0, closet: false, rare: false, weight: 8 },
        { label: '👔 Closet!',       pts: 0,  tickets: 0,  freezes: 0, closet: true,  rare: false, weight: 5 },
        { label: '🧊 Freeze!',       pts: 0,  tickets: 0,  freezes: 1, closet: false, rare: false, weight: 4 },
        { label: '⭐ 50 pts',        pts: 50, tickets: 0,  freezes: 0, closet: false, rare: false, weight: 3 },
        { label: '🎟️ 5 Tickets',    pts: 0,  tickets: 5,  freezes: 0, closet: false, rare: false, weight: 1.5 },
        { label: '💎 RARE!',         pts: 0,  tickets: 0,  freezes: 0, closet: false, rare: true,  weight: 1.5 },
    ];

    // Rare drop sub-table
    const rareOutcomes = [
        { label: '🎟️ 10 Tickets',       tickets: 10,   weight: 1000 },
        { label: '🎟️ 25 Tickets',       tickets: 25,   weight: 500 },
        { label: '🎟️ 50 Tickets',       tickets: 50,   weight: 100 },
        { label: '🎟️ 100 Tickets!',     tickets: 100,  weight: 50 },
        { label: '🎟️ 500 Tickets!!',    tickets: 500,  weight: 10 },
        { label: '🎟️💎 1,000 Tickets!!!', tickets: 1000, weight: 3 },
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
        const userDoc = await tx.get(userRef);
        if (!userDoc.exists) throw new functions.https.HttpsError('not-found', 'User not found');

        const userData = userDoc.data();
        if (userData.lastSpinDate === today) {
            throw new functions.https.HttpsError('already-exists', 'Already spun today');
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

        // Atomic update
        const update = {
            lastSpinDate: today,
        };
        if (totalPts > 0) update.points = admin.firestore.FieldValue.increment(totalPts);
        if (totalTickets > 0) update.orangeTickets = admin.firestore.FieldValue.increment(totalTickets);
        if (totalFreezes > 0) update.streakFreezes = admin.firestore.FieldValue.increment(totalFreezes);
        tx.update(userRef, update);

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
        };
    });

    return { success: true, reward: result };
});

// ---- Update PVP Stats (server-side) ----
// updatePvpStats and incrementUserStat REMOVED - exploitable without verification.
// PVP stats are handled atomically inside pvpSubmitAnswer when match finishes.
// Forum/market stats are display-only (not gated or redeemable).

// ── PVP Store Answer Key (called by player-2 matchmaker after client-side match creation) ──
// Validates that the caller is a player in the match before accepting keys.
exports.pvpStoreAnswerKey = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    const { matchId, keys, keyIndex } = data || {};
    // keys: array of correct-answer integers
    // keyIndex: when set, this is a reroll — update one specific slot rather than the full array
    if (!matchId || !Array.isArray(keys) || keys.length < 1 || keys.length > 10) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid matchId or keys');
    }
    // Validate keys are all valid integers (0-3)
    for (const k of keys) {
        if (typeof k !== 'number' || k < 0 || k > 3 || !Number.isInteger(k)) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid key value');
        }
    }
    const uid = context.auth.uid;
    const matchSnap = await db.collection('pvp_matches').doc(matchId).get();
    if (!matchSnap.exists) throw new functions.https.HttpsError('not-found', 'Match not found');
    const match = matchSnap.data();
    // Only a player in the match can store the answer key
    if (match.player1.uid !== uid && match.player2.uid !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'Not a player in this match');
    }
    const keyRef = db.collection('pvp_answer_keys').doc(matchId);
    const existing = await keyRef.get();

    if (typeof keyIndex === 'number' && keyIndex >= 0 && keyIndex <= 4) {
        // Reroll update: patch one specific slot in an existing key document
        if (!existing.exists) throw new functions.https.HttpsError('not-found', 'Answer key not found for reroll');
        const existingKeys = existing.data().keys || [];
        const updated = existingKeys.slice();
        // Find or create the entry for this index
        const slotIdx = updated.findIndex(k => k.questionIndex === keyIndex);
        if (slotIdx >= 0) {
            updated[slotIdx] = { questionIndex: keyIndex, correct: keys[0] };
        } else {
            updated.push({ questionIndex: keyIndex, correct: keys[0] });
        }
        await keyRef.update({ keys: updated });
        return { success: true, reroll: true };
    }

    // Initial store: only if not already set
    if (existing.exists) return { success: true, alreadySet: true };
    await keyRef.set({
        keys: keys.map((correct, i) => ({ questionIndex: i, correct })),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        setBy: uid
    });
    return { success: true };
});

// ── PVP Match Creation (server-side, hides answer keys) ──
exports.pvpCreateMatch = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');

    const { lobbyDocId, player1, player2, questions } = data || {};
    if (!lobbyDocId || !player1 || !player2 || !questions || !Array.isArray(questions)) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }
    if (questions.length < 1 || questions.length > 10) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid question count');
    }

    // Store answer keys separately (not readable by clients)
    const answerKeys = questions.map((q, i) => ({ questionIndex: i, correct: q.correct }));

    // Strip correct answer — clients must NOT receive the answer key in the match doc.
    // Server validates answers via pvpSubmitAnswer / pvpAnswer CF only.
    const clientQuestions = questions.map(q => ({
        q: q.q,
        options: q.options
        // correct intentionally omitted — stored only in pvp_answer_keys
    }));

    // Use a transaction to atomically claim the lobby doc and create the match.
    // This prevents the race condition where both players try to create a match
    // against each other simultaneously.
    const lobbyRef = db.collection('pvp_lobby').doc(lobbyDocId);
    const matchRef = db.collection('pvp_matches').doc(); // pre-generate ID

    await db.runTransaction(async (tx) => {
        const lobbySnap = await tx.get(lobbyRef);
        if (!lobbySnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Lobby entry not found');
        }
        const lobbyData = lobbySnap.data();
        if (lobbyData.status !== 'waiting') {
            throw new functions.https.HttpsError('already-exists', 'Opponent already matched');
        }

        // Create the match document
        tx.set(matchRef, {
            player1: {
                uid: player1.uid,
                name: (player1.name || 'Anonymous').substring(0, 30),
                profilePic: player1.profilePic || '',
                score: 0, correct: 0, answers: []
            },
            player2: {
                uid: player2.uid,
                name: (player2.name || 'Anonymous').substring(0, 30),
                profilePic: player2.profilePic || '',
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
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Atomically mark lobby as matched
        tx.update(lobbyRef, {
            status: 'matched',
            matchId: matchRef.id,
            opponentName: (player2.name || 'Anonymous').substring(0, 30),
            opponentUid: player2.uid,
            opponentProfilePic: player2.profilePic || ''
        });
    });

    return { matchId: matchRef.id };
});

// ── Scholar Exam: Server-Side Grading ──
// SCHOLAR_BANK is loaded once per cold start. Contains authoritative correct answers.
// Format: { properties: [{a: "..."}, ...], technical: [{a: "..."}, ...] }
const SCHOLAR_BANK = require('./scholar-bank.json');

function _pickScholarQuestions(type) {
    const pool = type === 'technical' ? SCHOLAR_BANK.technical : SCHOLAR_BANK.properties;
    if (!Array.isArray(pool) || pool.length < 25) {
        throw new functions.https.HttpsError('internal', 'Exam bank misconfigured');
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

exports.startScholarExam = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    if (context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functions.https.HttpsError('permission-denied', 'Anonymous users cannot take exams');
    }

    const { type } = data || {};
    if (type !== 'properties' && type !== 'technical') {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid exam type');
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

exports.gradeScholarExam = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');

    const { examId, answers } = data || {};
    if (!examId || !answers || !Array.isArray(answers)) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing examId or answers');
    }
    if (answers.length !== 25) {
        throw new functions.https.HttpsError('invalid-argument', 'Must have exactly 25 answers');
    }

    const uid = context.auth.uid;
    const examRef = db.collection('scholar_exam_keys').doc(examId);

    const result = await db.runTransaction(async (tx) => {
        const examDoc = await tx.get(examRef);
        if (!examDoc.exists) throw new functions.https.HttpsError('not-found', 'Exam not found');

        const exam = examDoc.data();
        if (exam.uid !== uid) throw new functions.https.HttpsError('permission-denied', 'Not your exam');
        if (exam.graded) throw new functions.https.HttpsError('already-exists', 'Exam already graded');

        const type = exam.type;
        const keyPrefix = type === 'technical' ? 'tech' : 'prop';
        const today = new Date().toISOString().split('T')[0];

        // Read user doc to enforce once-per-day + once-per-cert rules
        const userRef = db.collection('users').doc(uid);
        const userDoc = await tx.get(userRef);
        const userData = userDoc.exists ? userDoc.data() : {};
        const alreadyPassed = userData['certPassed_' + keyPrefix] === true;
        const lastAttempt = userData['lastExamAttempt_' + keyPrefix];

        // Block double-dipping: once passed, no more points for this cert type
        if (alreadyPassed) {
            tx.update(examRef, { graded: true, score: 0, passed: false, blocked: 'already_certified', gradedAt: admin.firestore.FieldValue.serverTimestamp() });
            throw new functions.https.HttpsError('failed-precondition', 'You already hold this certification.');
        }
        // Block rapid retakes same day (daily cooldown)
        if (lastAttempt === today) {
            tx.update(examRef, { graded: true, score: 0, passed: false, blocked: 'daily_limit', gradedAt: admin.firestore.FieldValue.serverTimestamp() });
            throw new functions.https.HttpsError('resource-exhausted', 'Only one exam attempt per 24 hours.');
        }

        // Grade server-side using server-held keys
        let score = 0;
        const keys = exam.keys;
        for (let i = 0; i < 25; i++) {
            if (answers[i] === keys[i].correct) score++;
        }

        const passed = score >= 20;

        // Mark exam as graded
        tx.update(examRef, { graded: true, score, passed, gradedAt: admin.firestore.FieldValue.serverTimestamp() });

        // Save attempt date (rate-limits to one attempt per UTC day)
        const attemptField = 'lastExamAttempt_' + keyPrefix;
        const update = {};
        update[attemptField] = today;

        if (passed) {
            // Award points server-side. Still increments directly (outside daily cap by design),
            // but now limited to ONCE per cert type thanks to the alreadyPassed gate above.
            update.points = admin.firestore.FieldValue.increment(2100);
            update['certPassed_' + keyPrefix] = true;
            update['certPassedAt_' + keyPrefix] = admin.firestore.FieldValue.serverTimestamp();
        }

        tx.update(userRef, update);

        return { score, passed, type };
    });

    return { success: true, score: result.score, passed: result.passed, type: result.type };
});

// ── Quest: Server-Side Grading ──
exports.startQuest = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');

    const { questions, topicKey } = data || {};
    if (!questions || !Array.isArray(questions) || questions.length < 3 || questions.length > 5) {
        throw new functions.https.HttpsError('invalid-argument', 'Must have 3-5 questions');
    }

    const uid = context.auth.uid;

    // Server-side guard: reject if user already perfected this topic
    if (topicKey) {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
            const completed = userDoc.data().completedQuests || [];
            if (completed.includes('quest_' + topicKey)) {
                throw new functions.https.HttpsError('already-exists',
                    'You already got a perfect score on this topic!');
            }
        }
    }

    const questId = uid + '_quest_' + Date.now();

    // Store answer keys server-side
    const answerKeys = questions.map((q, i) => ({ index: i, correct: q.answer }));

    await db.collection('quest_answer_keys').doc(questId).set({
        uid,
        keys: answerKeys,
        topicKey: topicKey || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        graded: false,
    });

    return { questId };
});

exports.gradeQuest = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');

    const { questId, answers, isRetry } = data || {};
    if (!questId || !answers || !Array.isArray(answers) || answers.length !== 5) {
        throw new functions.https.HttpsError('invalid-argument', 'Must have exactly 5 answers');
    }

    const uid = context.auth.uid;
    const questRef = db.collection('quest_answer_keys').doc(questId);
    const userRef = db.collection('users').doc(uid);

    // AUDIT FIX (2026-04-22): gradeQuest was writing points directly to user doc,
    // bypassing the 500 pts/day cap. Now it routes through daily_points with a
    // hard cap AND enforces a per-day quest grading limit to stop abuse.
    const DAILY_QUEST_LIMIT = 3;   // max completed quests per UTC day
    const DAILY_POINTS_CAP = 500;  // matches awardPoints cap exactly
    const today = new Date().toISOString().split('T')[0]; // UTC midnight — kept for raw audit logs only
    const offsetToday = getOffsetDateKey(); // 5 AM UTC — single source of truth for all daily gates
    const dailyQuestRef = userRef.collection('daily_action_counts').doc(offsetToday + '_quest');
    const dailyPtsRef = userRef.collection('daily_points').doc(offsetToday);

    const result = await db.runTransaction(async (tx) => {
        const questDoc = await tx.get(questRef);
        if (!questDoc.exists) throw new functions.https.HttpsError('not-found', 'Quest not found');

        const quest = questDoc.data();
        if (quest.uid !== uid) throw new functions.https.HttpsError('permission-denied', 'Not your quest');
        if (quest.graded) throw new functions.https.HttpsError('already-exists', 'Quest already graded');

        // Per-day quest count limit (reject before grading to conserve work)
        const qCountDoc = await tx.get(dailyQuestRef);
        const qCountToday = qCountDoc.exists ? (qCountDoc.data().count || 0) : 0;
        if (qCountToday >= DAILY_QUEST_LIMIT) {
            throw new functions.https.HttpsError('resource-exhausted',
                `Daily quest limit reached (max ${DAILY_QUEST_LIMIT}/day). Try again tomorrow.`);
        }

        // Grade server-side
        let score = 0;
        const keys = quest.keys;
        for (let i = 0; i < 5; i++) {
            if (answers[i] === keys[i].correct) score++;
        }

        // Determine points
        let pts = 0;
        if (isRetry) {
            if (score >= 3) pts = 25;
        } else {
            if (score === 5) pts = 100;
            else if (score >= 3) pts = 50;
        }

        // Route points through daily_points cap (same as awardPoints CF).
        // Excess goes into pendingOverflow (server-managed, redeemed on future days).
        let awarded = 0;
        let capped = false;
        let overflowAdded = 0;
        if (pts > 0) {
            const userDoc = await tx.get(userRef);
            const userData = userDoc.exists ? userDoc.data() : {};
            const dailyDoc = await tx.get(dailyPtsRef);
            const dailyUsed = dailyDoc.exists ? (dailyDoc.data().total || 0) : 0;
            if (dailyUsed < DAILY_POINTS_CAP) {
                awarded = pts;
                if (dailyUsed + pts > DAILY_POINTS_CAP) {
                    awarded = DAILY_POINTS_CAP - dailyUsed;
                    overflowAdded = pts - awarded;
                }
                if (awarded < 0) awarded = 0;
            } else {
                overflowAdded = pts;
            }
            capped = (dailyUsed + awarded >= DAILY_POINTS_CAP);

            const userUpdate = {};
            if (awarded > 0) {
                userUpdate.points = admin.firestore.FieldValue.increment(awarded);
                tx.set(dailyPtsRef, {
                    total: dailyUsed + awarded,
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }
            if (overflowAdded > 0) {
                userUpdate.pendingOverflow = admin.firestore.FieldValue.increment(overflowAdded);
                userUpdate.lastOverflowDate = offsetToday;
            }
            if (Object.keys(userUpdate).length > 0) {
                tx.update(userRef, userUpdate);
            }
        }

        // Always increment the per-day quest count so retries / low-score attempts still count
        tx.set(dailyQuestRef, {
            count: admin.firestore.FieldValue.increment(1),
            lastAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Mark as graded (prevents replay on same questId)
        tx.update(questRef, {
            graded: true, score, pts, awarded,
            gradedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Perfect 5/5 on a topic quest: persist topic-based completion server-side
        if (score === 5 && quest.topicKey) {
            tx.update(userRef, {
                completedQuests: admin.firestore.FieldValue.arrayUnion('quest_' + quest.topicKey)
            });
        }

        return { score, pts, awarded, capped, questsToday: qCountToday + 1, dailyQuestLimit: DAILY_QUEST_LIMIT };
    });

    return result;
});


// =============================================
// AUDIT FIX: Secure Certificate Issuance (M-NEW-15)
// Only issues certificates if user has passed the exam server-side
// =============================================
exports.issueCertificate = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');

    const uid = context.auth.uid;
    const { type, name } = data || {};

    if (!type || !['scholar', 'technical', 'trail_meadow', 'trail_mountain', 'trail_summit'].includes(type)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid certificate type');
    }

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) throw new functions.https.HttpsError('not-found', 'User not found');
    const userData = userDoc.data();

    // Verify passing status from server-authoritative fields only
    // Note: These fields are updated via Admin SDK in grading functions
    let passed = false;
    let title = 'Bitcoiner';
    let score = null;

    if (type === 'scholar') {
        passed = userData.scholar_exam_passed === true;
        title = 'Bitcoin Scholar';
        score = userData.scholar_exam_score || 'Passed';
    } else if (type === 'technical') {
        passed = userData.scholar_tech_passed === true;
        title = 'Bitcoin Protocol Expert';
        score = userData.scholar_tech_score || 'Passed';
    } else if (type.startsWith('trail_')) {
        // Find the specific trail in the list of passed trails
        const passedTrails = userData.trails_passed || [];
        passed = passedTrails.includes(type.replace('trail_', ''));
        title = 'Nacho Trail Complete';
    }

    if (!passed) {
        throw new functions.https.HttpsError('permission-denied', 'You have not passed the requirements for this certificate.');
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
exports.onChatMessageCreated = functions.firestore
    .document('global_chat/{msgId}')
    .onCreate(async (snap, _context) => {
        const data = snap.data() || {};
        // Skip bot/nacho/system messages so the counter reflects real users
        if (data.uid === 'nacho-bot' || data.uid === 'system') return null;
        if (data.isNachoAuto === true) return null;
        try {
            await db.collection('stats').doc('global').set({
                chatMessages: admin.firestore.FieldValue.increment(1)
            }, { merge: true });
        } catch (e) { console.error('[onChatMessageCreated] failed:', e); }
        return null;
    });

// PVP match finished → bump pvpMatches (only once per match)
exports.onPvpMatchFinished = functions.firestore
    .document('pvp_matches/{matchId}')
    .onUpdate(async (change, _context) => {
        const before = change.before.data() || {};
        const after = change.after.data() || {};
        // Count only the transition into finished (not forfeit, not repeated writes)
        if (before.status === 'finished') return null;
        if (after.status !== 'finished') return null;
        try {
            await db.collection('stats').doc('global').set({
                pvpMatches: admin.firestore.FieldValue.increment(1)
            }, { merge: true });
        } catch (e) { console.error('[onPvpMatchFinished] failed:', e); }
        return null;
    });

// New user doc created → bump userCount + assign plebNumber
exports.onUserDocCreated = functions.firestore
    .document('users/{uid}')
    .onCreate(async (snap, context) => {
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

// ---- Live triggers for community stats: channelVisits, questsCompleted, watchTimeMinutes ----

// Channel visit → bump global channelVisits (detects channelsVisited increment on user doc)
exports.onUserChannelVisit = functions.firestore
    .document('users/{uid}')
    .onUpdate(async (change, _context) => {
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
exports.onUserQuestCompleted = functions.firestore
    .document('users/{uid}')
    .onUpdate(async (change, _context) => {
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
exports.resetCommunityStats = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    const email = (context.auth.token.email || '').toLowerCase();
    if (['needcreations@gmail.com','info.603btc@gmail.com','najemchris8@gmail.com'].indexOf(email) === -1) {
        throw new functions.https.HttpsError('permission-denied', 'Admin only');
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
exports.dailyActiveUsers = functions.https.onRequest(async (req, res) => {
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
        res.status(500).json({ error: e.message });
    }
});




// ===== INVESTIGATE SPECIFIC UIDS (admin-only) =====
// One-shot investigation endpoint: accepts up to 20 UIDs, returns full records +
// cross-referenced signals (same IP, same lightning address, giveaway entries,
// points sources, account age, auth method, bestStreak sanity, etc).
exports.investigateUsers = functions.https.onRequest(async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const uidsParam = req.query.uids || '';
    const uids = uidsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 20);
    if (!uids.length) { res.status(400).json({ error: 'Pass ?uids=UID1,UID2,...' }); return; }

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
        res.status(500).json({ error: e.message });
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
    'seedyroute27@walletofsatoshi.com'
];

exports.watchlistCheck = functions.https.onRequest(async (req, res) => {
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

        // 3. Scan active users for new uses of blacklisted LN addresses
        try {
            const blSnap = await db.collection('giveaway_entries').get();
            blSnap.forEach(g => {
                const gd = g.data();
                const ln = ((gd.lightningAddress || gd.lnAddress || '') + '').toLowerCase().trim();
                if (ln && BLACKLISTED_LN.includes(ln)) {
                    out.blacklistedLnHits.push({ uid: g.id.substring(0,8), ln });
                }
            });
            if (out.blacklistedLnHits.length > BLACKLISTED_LN.length) {
                out.alerts.push(`\ud83d\udea8 ${out.blacklistedLnHits.length} giveaway entries with blacklisted LN addresses`);
            }
        } catch (e) {}

        res.json(out);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// =============================================
// AUDIT WITHDRAWALS - Admin endpoint for monitoring blocked accounts & investigating withdrawal clusters
// =============================================
exports.auditWithdrawals = functions.https.onRequest(async (req, res) => {
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
        res.status(500).json({ error: e.message });
    }
});

// =============================================
// TCTV Presence Aggregation - Scalable Live Viewer Counter
// Runs every 10 seconds, aggregates presence docs into per-station counts
// =============================================
exports.tctvAggregatePresence = onSchedule({
    schedule: 'every 10 seconds',
    timeZone: 'UTC',
    retryCount: 0,
}, async (event) => {
    try {
        const now = Date.now();
        const staleThreshold = 65000; // 65 seconds (matches client-side filter)

        // Get all presence docs
        const presenceSnap = await db.collection('tctv_presence').get();

        // Aggregate by station
        const counts = {};
        presenceSnap.forEach(doc => {
            const d = doc.data();
            if (!d.station) return;

            // Check staleness (same logic as client)
            let docTime = 0;
            if (d.ts && d.ts.toMillis) docTime = d.ts.toMillis();
            else if (typeof d.tsClient === 'number') docTime = d.tsClient;

            if (!docTime) return;
            if (now - docTime > staleThreshold) return; // Stale

            counts[d.station] = (counts[d.station] || 0) + 1;
        });

        // Write aggregated counts to tctv_counts (one doc per station)
        const batch = db.batch();
        for (const [stationId, count] of Object.entries(counts)) {
            const countRef = db.collection('tctv_counts').doc(stationId);
            batch.set(countRef, {
                count: count,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }

        // Handle stations with 0 viewers (delete the doc or set count to 0)
        // Get existing count docs to find ones that should be 0
        const existingSnap = await db.collection('tctv_counts').get();
        existingSnap.forEach(doc => {
            if (!counts[doc.id]) {
                // No viewers on this station anymore
                batch.delete(doc.ref);
            }
        });

        await batch.commit();

        console.log('[TCTV] Aggregated presence:', Object.keys(counts).length + ' stations, total viewers:', Object.values(counts).reduce((a,b)=>a+b, 0));
        return null;
    } catch (e) {
        console.error('[TCTV] Aggregation error:', e.message);
        return null;
    }
});

// ==========================================
// PROOF OF WALK (STRAVA INTEGRATION)
// ==========================================

exports.stravaAuth = functions.https.onRequest(async (req, res) => {
    try {
        const code = req.query.code;
        const uid = req.query.state; // Passed from frontend via state param

        if (!code || !uid) {
            return res.redirect('https://bitcoineducation.quest/#explore?strava=error-missing-params');
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

exports.syncStravaWalks = functions.https.onCall(async (data, context) => {
    console.log('[POW] syncStravaWalks called');
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    const uid = context.auth.uid;
    console.log('[POW] uid:', uid);

    const stravaRef = db.collection('users').doc(uid).collection('integrations').doc('strava');
    const stravaDoc = await stravaRef.get();
    if (!stravaDoc.exists) throw new functions.https.HttpsError('not-found', 'Strava not connected');

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
            throw new functions.https.HttpsError('permission-denied', 'Strava auth expired, please reconnect');
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
        throw new functions.https.HttpsError('internal', 'Strava API failed: ' + JSON.stringify(activities).substring(0, 100));
    }

    let totalPoints = 0;
    let syncedCount = 0;

    const userRef = db.collection('users').doc(uid);
    const statsRef = userRef.collection('proof_of_walk_stats').doc('daily');
    const validTypes = ["Walk", "Run", "Hike"];
    const results = [];

    // Filter eligible activities first
    const eligible = activities.filter(act => validTypes.includes(act.type));
    if (eligible.length === 0) return { success: true, synced: 0, pointsEarned: 0, activities: [] };

    // Atomic transaction - all reads first, then all writes (Firestore requirement)
    await db.runTransaction(async (transaction) => {
        // Phase 1: READ all docs we need
        const dailyDoc = await transaction.get(statsRef);
        const userDoc = await transaction.get(userRef);
        const actRefs = [];
        const actDocs = [];
        for (const act of eligible) {
            const ref = userRef.collection('proof_of_walk').doc(act.id.toString());
            actRefs.push(ref);
            actDocs.push(await transaction.get(ref));
        }

        // Phase 2: COMPUTE points
        let dailyData = dailyDoc.exists ? dailyDoc.data() : { date: '', distance: 0 };
        const currentPoints = userDoc.exists ? (userDoc.data().points || 0) : 0;

        for (let i = 0; i < eligible.length; i++) {
            if (actDocs[i].exists) continue; // Already processed
            const act = eligible[i];
            const actId = act.id.toString();
            const dateStr = (act.start_date_local || act.start_date).split('T')[0];
            const actKm = act.distance / 1000;

            if (dailyData.date !== dateStr) {
                dailyData = { date: dateStr, distance: 0 };
            }

            const remainingCap = Math.max(0, 42.0 - dailyData.distance);
            const allocatableKm = Math.min(actKm, remainingCap);
            const pts = Math.floor(allocatableKm * 50);

            dailyData.distance += allocatableKm;
            totalPoints += pts;
            syncedCount++;

            results.push({ id: actId, type: act.type, distance: actKm, points: pts, date: dateStr });

            // Phase 3: WRITE (after all reads are done)
            transaction.set(actRefs[i], {
                distance: actKm,
                points_awarded: pts,
                date: dateStr,
                type: act.type,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        if (syncedCount > 0) {
            transaction.set(statsRef, dailyData);
            transaction.update(userRef, {
                points: currentPoints + totalPoints
            });
        }
    });

    console.log('[POW] Done. synced:', syncedCount, 'pts:', totalPoints);
    return { success: true, synced: syncedCount, pointsEarned: totalPoints, activities: results };
});
exports.adminLookupUser = functions.https.onRequest(async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        let q = req.query.q;
        let snap1 = await db.collection('users').where('email', '==', q).get();
        let snap2 = await db.collection('users').where('displayName', '==', q).get();
        let out = [];
        snap1.forEach(d => out.push({uid: d.id, ...d.data()}));
        snap2.forEach(d => { if (!out.find(x => x.uid === d.id)) out.push({uid: d.id, ...d.data()}); });
        res.json(out);
    } catch(e) { res.status(500).json({error: e.toString()}); }
});
exports.adminQueryUsers = functions.https.onRequest(async (req, res) => {
    if (!requireAdmin(req, res)) return;
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
    } catch(e) { res.status(500).json({error:e.toString()});}
});
// [VULN-7 FIX] adminBanUser — sets ban flags in BOTH user doc and faucet_ledger atomically.
// The ledger ban survives user-doc deletion (faucet_ledger is write:false for clients).
exports.adminBanUser = functions.https.onRequest(async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        const uid = req.query.uid;
        const reason = (req.query.reason || 'admin ban').substring(0, 200);
        if (!uid) return res.status(400).json({error: 'uid required'});
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
    } catch(e) { res.status(500).json({error:e.toString()});}
});

exports.adminUnbanUser = functions.https.onRequest(async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        const uid = req.query.uid;
        if (!uid) return res.status(400).json({error: 'uid required'});
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
        });
        // Clear the ledger ban. set+merge so the doc is created if it doesn't exist yet.
        batch.set(db.collection('faucet_ledger').doc(uid), {
            banned: false,
            ban_reason: admin.firestore.FieldValue.delete(),
            bannedAt: admin.firestore.FieldValue.delete(),
        }, { merge: true });
        await batch.commit();
        res.json({success: true, uid});
    } catch(e) { res.status(500).json({error:e.toString()});}
});

// ===== RAID BOSS =====
const { scheduleRaidBoss } = require('./src/scheduleRaidBoss');
const { contributeRaid } = require('./src/contributeRaid');
exports.scheduleRaidBoss = scheduleRaidBoss;
exports.contributeRaid = contributeRaid;

// ===== SATOSHI'S FAVOR =====
const { contributeFavor, hashForFavor, checkFavorState, getFavorHashes, syncCycleToTop10, backfillFactionTotals, syncUserFactionPoints, getFactionTotals } = require('./src/satoshiFavor');
exports.contributeFavor = contributeFavor;
exports.hashForFavor = hashForFavor;
exports.checkFavorState = checkFavorState;
exports.getFavorHashes = getFavorHashes;
exports.syncCycleToTop10 = syncCycleToTop10;
exports.backfillFactionTotals = backfillFactionTotals;
exports.syncUserFactionPoints = syncUserFactionPoints;
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
exports.donatePoints = functions.https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.uid) throw new functions.https.HttpsError('unauthenticated', 'Sign in to donate.');
    if (context.auth.token.firebase && context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functions.https.HttpsError('permission-denied', 'Create an account to donate.');
    }

    const uid = context.auth.uid;
    const amount = Math.floor(Number(data.amount));
    const anonymous = data.anonymous === true;

    if (!amount || amount < 1) throw new functions.https.HttpsError('invalid-argument', 'Donation must be at least 1 point.');
    if (amount > 1000000) throw new functions.https.HttpsError('invalid-argument', 'Donation too large.');

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
        if (!userDoc.exists) throw new functions.https.HttpsError('not-found', 'User not found.');
        const u = userDoc.data();

        const points = u.points || 0;
        const pointsClaimed = u.pointsClaimed || 0;
        const pointsDonated = u.pointsDonated || 0;
        const available = points - pointsClaimed - pointsDonated;

        // Faction required - donations must be attributed to a side
        if (!u.faction || (u.faction !== 'cyber_hornets' && u.faction !== 'honey_badgers')) {
            throw new functions.https.HttpsError('failed-precondition',
                'You must choose a faction (Cyber Hornets or Honey Badgers) before donating.');
        }

        if (available < amount) {
            throw new functions.https.HttpsError('failed-precondition',
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
            userUpdate.points = admin.firestore.FieldValue.increment(bonusPts);
        }
        if (donationTicket > 0) {
            userUpdate.orangeTickets = admin.firestore.FieldValue.increment(donationTicket);
        }
        tx.update(userRef, userUpdate);

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
        // Use update() so dot-notation keys are treated as nested field paths,
        // not literal string keys (which is what set+merge does).
        const statsUpdate = {
            totalDonated: admin.firestore.FieldValue.increment(amount),
            updatedAt: ts,
            [`factionTotals.${factionKey}`]: admin.firestore.FieldValue.increment(amount),
        };
        tx.set(statsRef, statsUpdate, { merge: true });
    });

    return { success: true, newBadges, bonusPts, donationTicket };
});

// ===== LEADERBOARD USER SEARCH =====
// Fetches top users ordered by points, filters by substring match (case-insensitive),
// returns matched users with their true rank. Supports cursor-based pagination.
exports.searchUsers = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');

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
exports.v4vSplitRelay = functions.https.onCall(async (data, context) => {
    const { trackId, amountSats } = data || {};
    if (!trackId) throw new functions.https.HttpsError('invalid-argument', 'trackId required');
    if (!amountSats || amountSats < 10) throw new functions.https.HttpsError('invalid-argument', 'amountSats must be >= 10');
    if (amountSats > 10000000) throw new functions.https.HttpsError('invalid-argument', 'amountSats too large');

    const trackDoc = await admin.firestore().collection('beats_tracks').doc(trackId).get();
    if (!trackDoc.exists) throw new functions.https.HttpsError('not-found', 'Track not found');
    const track    = trackDoc.data();
    const splits   = (track.v4vSplits || []).filter(s => s.split > 0);

    if (splits.length === 0) throw new functions.https.HttpsError('failed-precondition', 'No V4V splits defined for this track');

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
                paymentRequest = await fetchLnurlInvoice(ln, recipMsats, `V4V: ${track.title}`);
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
            console.error(`[v4vSplitRelay] Error for ${payType} ${ln||nodeAddress}:`, e.message);
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
                ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&bgcolor=1a1a2e&color=ffffff&data=${encodeURIComponent('lightning:' + paymentRequest)}`
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

// Helper: fetch LNURL-pay invoice for a Lightning address
async function fetchLnurlInvoice(lightningAddress, msats, comment) {
    const nodeFetch   = require('node-fetch');
    const [user, host] = lightningAddress.split('@');
    if (!user || !host) throw new Error(`Invalid lightning address: ${lightningAddress}`);

    const lnurlRes   = await nodeFetch(`https://${host}/.well-known/lnurlp/${user}`, { timeout: 10000 });
    if (!lnurlRes.ok) throw new Error(`LNURL-pay lookup failed for ${lightningAddress}`);
    const lnurlData  = await lnurlRes.json();
    if (lnurlData.status === 'ERROR') throw new Error(lnurlData.reason);

    // Clamp to provider min/max
    const clampedMsats = Math.min(Math.max(msats, lnurlData.minSendable || 1000), lnurlData.maxSendable || 1000000000);

    let cbUrl = `${lnurlData.callback}${lnurlData.callback.includes('?') ? '&' : '?'}amount=${clampedMsats}`;
    if (comment && lnurlData.commentAllowed > 0) {
        cbUrl += `&comment=${encodeURIComponent(comment.slice(0, lnurlData.commentAllowed))}`;
    }

    const invRes  = await nodeFetch(cbUrl, { timeout: 15000 });
    if (!invRes.ok) throw new Error(`Invoice request failed for ${lightningAddress}`);
    const invData = await invRes.json();
    if (invData.status === 'ERROR') throw new Error(invData.reason);
    if (!invData.pr) throw new Error(`No invoice returned for ${lightningAddress}`);

    return invData.pr;
}

// ===== BACKFILL DONATION FACTION =====
// When a user picks their faction for the first time, attribute any charity
// donations they made under 'no_faction' (or with null faction) to their new faction.
exports.backfillDonationFaction = functions.https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.uid) throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
    if (context.auth.token.firebase && context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functions.https.HttpsError('permission-denied', 'Account required.');
    }

    const uid = context.auth.uid;
    const newFaction = (data.newFaction || '').trim();
    if (newFaction !== 'cyber_hornets' && newFaction !== 'honey_badgers') {
        throw new functions.https.HttpsError('invalid-argument', 'Valid faction required.');
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
exports.backfillJoinDates = functions.https.onRequest(async (req, res) => {
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
    await userRef.update({
        orangeTickets: admin.firestore.FieldValue.increment(ticketCount),
    });
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

exports.resetWeeklyXP = functions.pubsub.schedule('0 5 * * 1').timeZone('UTC').onRun(async (ctx) => { // Monday 5 AM UTC — consistent with daily reset boundary
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

exports.resetMonthlyXP = functions.pubsub.schedule('0 0 1 * *').timeZone('UTC').onRun(async (ctx) => {
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
// 🧊 FEATURE 5: Spend Orange Tickets for Streak Freezes
// ══════════════════════════════════════════════════════════════════════

exports.spendTicketsForFreeze = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    if (context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functions.https.HttpsError('permission-denied', 'Anonymous users cannot purchase freezes');
    }

    const uid = context.auth.uid;
    const amount = parseInt(data.amount) || 1;
    if (![1, 3].indexOf(amount) === -1 && amount !== 1 && amount !== 3) {
        throw new functions.https.HttpsError('invalid-argument', 'Amount must be 1 or 3');
    }

    const FREEZE_COSTS = { 1: 5, 3: 12 }; // tickets per freeze bundle
    const ticketCost = FREEZE_COSTS[amount] || 5;

    const userRef = db.collection('users').doc(uid);
    const result = await db.runTransaction(async (t) => {
        const doc = await t.get(userRef);
        if (!doc.exists) throw new functions.https.HttpsError('not-found', 'User not found');
        const userData = doc.data();
        const currentTickets = userData.orangeTickets || 0;
        const currentFreezes = userData.streakFreezes || 0;

        if (currentTickets < ticketCost) {
            throw new functions.https.HttpsError('resource-exhausted',
                `Not enough tickets. You have ${currentTickets} but need ${ticketCost}.`);
        }

        const update = {
            orangeTickets: admin.firestore.FieldValue.increment(-ticketCost),
            streakFreezes: admin.firestore.FieldValue.increment(amount),
        };
        t.update(userRef, update);
        return {
            newTickets: currentTickets - ticketCost,
            newFreezes: currentFreezes + amount,
        };
    });

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
exports.seedWeeklyChallenge = functions.https.onCall(async (data, context) => {
    if (!context.auth || !['needcreations@gmail.com', 'info.603btc@gmail.com', 'najemchris8@gmail.com'].includes(context.auth.token.email)) {
        throw new functions.https.HttpsError('permission-denied', 'Admin only');
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
exports.incrementWeeklyChallenge = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    const uid = context.auth.uid;

    const goalType = (data.goalType || '').replace(/[^a-z_]/g, '').substring(0, 30);
    if (!goalType) throw new functions.https.HttpsError('invalid-argument', 'goalType required');

    const weekKey = _getCurrentWeekKey();
    const challengeRef = db.collection('weekly_challenges').doc(weekKey);

    const snap = await challengeRef.get();
    if (!snap.exists) return { success: false, reason: 'No active challenge' };

    const data2 = snap.data();
    if (data2.completed) return { success: false, reason: 'Already completed' };

    // Check if this goal type is valid
    const validGoal = (data2.goals || []).find(g => g.type === goalType);
    if (!validGoal) return { success: false, reason: 'Invalid goal type' };

    // Increment progress
    await challengeRef.update({
        [`progress.${goalType}`]: admin.firestore.FieldValue.increment(1),
        [`participants.${uid}`]: true,
    });

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
                const pRef = db.collection('users').doc(puid);
                const badgeRef = pRef.collection('badge_awards').doc('weekly_hero');
                const badgeDoc = await badgeRef.get();
                if (!badgeDoc.exists) {
                    await badgeRef.set({ awardedAt: admin.firestore.FieldValue.serverTimestamp() });
                    await pRef.update({
                        points: admin.firestore.FieldValue.increment(100),
                        weeklyXP: admin.firestore.FieldValue.increment(100),
                        monthlyXP: admin.firestore.FieldValue.increment(100),
                        visibleBadges: admin.firestore.FieldValue.arrayUnion('weekly_hero'),
                    });
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
    'streak_freeze':    { cost: 5,  type: 'consumable', name: 'Streak Freeze',           gives: { streakFreezes: 1 } },
    'hash_booster':     { cost: 10, type: 'consumable', name: 'Hash Booster',            gives: { hashBoosters: 1 } },
    'hint_token':       { cost: 3,  type: 'consumable', name: 'Hint Token',              gives: { hintTokens: 1 } },
    'double_xp':        { cost: 15, type: 'consumable', name: 'Double XP (60 min)',      gives: { doubleXP: 1 } },
    'bonus_spin':       { cost: 5,  type: 'consumable', name: 'Bonus Spin',              gives: { bonusSpins: 1 } },
    'profile_frame':    { cost: 50, type: 'cosmetic',   name: 'Profile Frame',           gives: { cosmetics: 'profile_frame' } },
    'chat_flair':       { cost: 40, type: 'cosmetic',   name: 'Chat Flair',              gives: { cosmetics: 'chat_flair' } },
    'pinned_badge':     { cost: 20, type: 'cosmetic',   name: 'Pinned Badge',            gives: { cosmetics: 'pinned_badge' } },
    'nacho_skin_nook':  { cost: 60, type: 'cosmetic',   name: 'Exclusive Nacho Skin',    gives: { cosmetics: 'nacho_skin_nook' } },
    'raffle_entry':     { cost: 10, type: 'raffle',     name: 'Sats Raffle Entry',       gives: { raffleEntries: 1 } },
    'streak_freeze_3':  { cost: 12, type: 'consumable', name: '3× Streak Freezes',      gives: { streakFreezes: 3 } },
    'hint_token_5':     { cost: 12, type: 'consumable', name: '5× Hint Tokens',         gives: { hintTokens: 5 } },
    'second_rig':       { cost: 25, type: 'consumable', name: 'Second Mining Rig',       gives: { secondRigCharges: 1 } },
};

exports.spendTickets = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    if (context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functions.https.HttpsError('permission-denied', 'Anonymous users cannot use the shop');
    }

    const uid = context.auth.uid;
    const itemId = (data.itemId || '').replace(/[^a-z0-9_]/g, '').substring(0, 40);
    const quantity = Math.max(1, Math.min(10, parseInt(data.quantity) || 1));

    const item = NOOK_SHOP_ITEMS[itemId];
    if (!item) throw new functions.https.HttpsError('invalid-argument', 'Unknown item: ' + itemId);

    // For bundles (streak_freeze_3, hint_token_5), quantity is always 1 (bundle is the unit)
    const isBundle = ['streak_freeze_3', 'hint_token_5'].includes(itemId);
    const qty = (item.type === 'consumable' && !isBundle) ? quantity : 1;
    const totalCost = item.cost * qty;

    const userRef = db.collection('users').doc(uid);

    return db.runTransaction(async (tx) => {
        const userDoc = await tx.get(userRef);
        if (!userDoc.exists) throw new functions.https.HttpsError('not-found', 'User not found');

        const userData = userDoc.data();
        const currentTickets = userData.orangeTickets || 0;

        if (currentTickets < totalCost) {
            throw new functions.https.HttpsError('failed-precondition',
                `Not enough tickets. Have ${currentTickets}, need ${totalCost}.`);
        }

        // Cosmetics: check not already owned (second_rig is renewable, skip check for it)
        if (item.type === 'cosmetic' && item.gives.cosmetics) {
            const owned = userData.ownedCosmetics || [];
            if (owned.includes(item.gives.cosmetics)) {
                throw new functions.https.HttpsError('already-exists', 'You already own this item.');
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
        if (g.doubleXP)       update.doubleXPCharges = admin.firestore.FieldValue.increment(g.doubleXP * qty);
        if (g.bonusSpins)        update.bonusSpins        = admin.firestore.FieldValue.increment(g.bonusSpins * qty);
        if (g.raffleEntries)     update.raffleEntries     = admin.firestore.FieldValue.increment(g.raffleEntries * qty);
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
            body: `You spent ${totalCost} 🎟️ on ${item.name}. Balance: ${currentTickets - totalCost} tickets.`,
            read: false,
            ts: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Compute new inventory counts to return to client
        const newInventory = {
            streakFreezes:  (userData.streakFreezes  || 0) + (g.streakFreezes  ? g.streakFreezes        : 0),
            hashBoosters:   (userData.hashBoosters   || 0) + (g.hashBoosters   ? g.hashBoosters * qty   : 0),
            hintTokens:     (userData.hintTokens     || 0) + (g.hintTokens     ? g.hintTokens           : 0),
            doubleXPCharges:(userData.doubleXPCharges|| 0) + (g.doubleXP       ? g.doubleXP * qty       : 0),
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
        };
    });
});

exports.convertPointsToTickets = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    if (context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functions.https.HttpsError('permission-denied', 'Anonymous users cannot convert XP');
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
        if (!userDoc.exists) throw new functions.https.HttpsError('not-found', 'User not found');

        const userData = userDoc.data();
        const todayCount = dailyDoc.exists ? (dailyDoc.data().count || 0) : 0;

        if (todayCount + tickets > MAX_PER_DAY) {
            throw new functions.https.HttpsError('resource-exhausted',
                `Daily limit: ${MAX_PER_DAY} tickets/day. Already converted ${todayCount} today.`);
        }

        const pointsCost = tickets * POINTS_PER_TICKET;
        const currentPoints = userData.points || 0;
        const _ptsClaimed = userData.pointsClaimed || 0;
        const _ptsDonated = userData.pointsDonated || 0;
        // [VULN] Must check available (unspent) points, not just raw total.
        // Raw points can exceed available once claims/donations are accounted for.
        const availableForExchange = currentPoints - _ptsClaimed - _ptsDonated;

        if (availableForExchange < pointsCost) {
            throw new functions.https.HttpsError('failed-precondition',
                `Need ${pointsCost.toLocaleString()} XP available, but only ${Math.max(0, availableForExchange).toLocaleString()} is unclaimed/undonated (total: ${currentPoints.toLocaleString()}).`);
        }

        tx.update(userRef, {
            points: admin.firestore.FieldValue.increment(-pointsCost),
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
            body: `Converted ${pointsCost.toLocaleString()} XP → ${tickets} 🎟️ ticket${tickets > 1 ? 's' : ''}. (${MAX_PER_DAY - todayCount - tickets} exchanges left today)`,
            read: false,
            ts: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
            success: true,
            newPoints: currentPoints - pointsCost,
            newTickets: (userData.orangeTickets || 0) + tickets,
            todayUsed: todayCount + tickets,
            remaining: MAX_PER_DAY - todayCount - tickets,
        };
    });
});

exports.activateHashBooster = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    if (context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functions.https.HttpsError('permission-denied', 'Anonymous users cannot activate boosters');
    }

    const uid = context.auth.uid;
    const userRef = db.collection('users').doc(uid);

    return db.runTransaction(async (tx) => {
        const userDoc = await tx.get(userRef);
        if (!userDoc.exists) throw new functions.https.HttpsError('not-found', 'User not found');

        const userData = userDoc.data();
        const hashBoosters = userData.hashBoosters || 0;

        if (hashBoosters < 1) {
            throw new functions.https.HttpsError('failed-precondition', 'No hash boosters available.');
        }

        // Grant +100 bonus hashes (added to hashBoosterHashes budget)
        // These bypass the cooldown entirely — user can hash 100x with no rate limit.
        // Once exhausted, normal cooldown resumes.
        tx.update(userRef, {
            hashBoosters: admin.firestore.FieldValue.increment(-1),
            hashBoosterHashes: admin.firestore.FieldValue.increment(100),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
            success: true,
            hashBoosterHashes: (userData.hashBoosterHashes || 0) + 100,
            hashBoosters: hashBoosters - 1,
        };
    });
});

exports.useHintToken = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    if (context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functions.https.HttpsError('permission-denied', 'Anonymous users cannot use hint tokens');
    }

    const uid = context.auth.uid;
    const userRef = db.collection('users').doc(uid);

    return db.runTransaction(async (tx) => {
        const userDoc = await tx.get(userRef);
        if (!userDoc.exists) throw new functions.https.HttpsError('not-found', 'User not found');

        const userData = userDoc.data();
        const hintTokens = userData.hintTokens || 0;

        if (hintTokens < 1) {
            throw new functions.https.HttpsError('failed-precondition', 'No hint tokens available.');
        }

        tx.update(userRef, {
            hintTokens: admin.firestore.FieldValue.increment(-1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: true, hintTokens: hintTokens - 1 };
    });
});

exports.activateDoubleXP = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    if (context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functions.https.HttpsError('permission-denied', 'Anonymous users cannot activate Double XP');
    }

    const uid = context.auth.uid;
    const userRef = db.collection('users').doc(uid);

    return db.runTransaction(async (tx) => {
        const userDoc = await tx.get(userRef);
        if (!userDoc.exists) throw new functions.https.HttpsError('not-found', 'User not found');

        const userData = userDoc.data();
        const charges = userData.doubleXPCharges || 0;

        if (charges < 1) {
            throw new functions.https.HttpsError('failed-precondition', 'No Double XP charges available.');
        }

        // Already active? extend or reject
        const now = admin.firestore.Timestamp.now();
        const existingExpiry = userData.doubleXPExpiry;
        const alreadyActive = existingExpiry && existingExpiry.toMillis() > now.toMillis();

        // Set expiry to now+60min (or extend if already active)
        const base = alreadyActive ? existingExpiry.toMillis() : now.toMillis();
        const newExpiry = admin.firestore.Timestamp.fromMillis(base + 3600000);

        tx.update(userRef, {
            doubleXPCharges: admin.firestore.FieldValue.increment(-1),
            doubleXPExpiry: newExpiry,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
            success: true,
            doubleXPExpiry: newExpiry.toMillis(),
            charges: charges - 1,
            extended: alreadyActive,
        };
    });
});

exports.useBonusSpin = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    if (context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw new functions.https.HttpsError('permission-denied', 'Anonymous users cannot use bonus spins');
    }

    const uid = context.auth.uid;
    const userRef = db.collection('users').doc(uid);

    return db.runTransaction(async (tx) => {
        const userDoc = await tx.get(userRef);
        if (!userDoc.exists) throw new functions.https.HttpsError('not-found', 'User not found');

        const userData = userDoc.data();
        const bonusSpins = userData.bonusSpins || 0;

        if (bonusSpins < 1) {
            throw new functions.https.HttpsError('failed-precondition', 'No bonus spins available.');
        }

        tx.update(userRef, {
            bonusSpins: admin.firestore.FieldValue.increment(-1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: true, bonusSpins: bonusSpins - 1 };
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// HOT TOPICS — Weekly Bitcoin trending topics aggregator
// Runs every Friday at 22:00 America/New_York (= Saturday 02:00–03:00 UTC)
// Sources: Brave Search (via nacho worker) + Reddit JSON + BitcoinTalk HTML
// AI: Cloudflare Workers AI Llama 4 Scout (free, uses existing CF credentials)
// Stores result in Firestore: hotTopics/latest
// ─────────────────────────────────────────────────────────────────────────────

const { onSchedule: onScheduleV2 } = require('firebase-functions/v2/scheduler');

// Trigger: Friday 10 PM Eastern (America/New_York handles DST automatically)
// Quality gate: reject fallback/template topics before they reach Firestore
function isRealTopics(topics) {
    if (!topics || !topics.length) return false;
    const SLOP_PHRASES = [
        'the bitcoin community is actively discussing',
        'multiple perspectives are circulating',
        'community members see positive developments',
        'others raise concerns and call for more caution',
        'discussion',
    ];
    // Reject if ANY topic summary contains boilerplate phrases
    for (const t of topics) {
        const summary = (t.summary || '').toLowerCase();
        const sideTexts = (t.sides || []).map(s => (s.summary || '').toLowerCase()).join(' ');
        if (SLOP_PHRASES.slice(0, 4).some(p => summary.includes(p))) {
            console.warn('[HotTopics] Quality gate rejected topic (boilerplate detected):', t.title);
            return false;
        }
        // Require specificity: summary must contain at least one of: a year, a BIP number, a proper noun (capitalized word 4+ chars)
        const hasSpecificity = /20\d{2}|BIP-?\d+|[A-Z][a-z]{3,}/.test(t.summary || '');
        if (!hasSpecificity) {
            console.warn('[HotTopics] Quality gate rejected topic (no specificity):', t.title);
            return false;
        }
    }
    return true;
}

exports.refreshHotTopics = onScheduleV2({
    schedule: '0 22 * * 5',
    timeZone: 'America/New_York',
    timeoutSeconds: 540,
    memory: '512MiB',
}, async (event) => {
    console.log('[HotTopics] Starting weekly refresh...');
    try {
        const topics = await buildHotTopics();
        if (!isRealTopics(topics)) {
            // AI failed and fallback produced slop — leave existing data intact
            console.warn('[HotTopics] Quality gate failed — keeping existing Firestore data intact, not overwriting with fallback slop');
            return;
        }
        await db.collection('hotTopics').doc('latest').set({
            topics,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            version: 1,
        });
        console.log('[HotTopics] Saved', topics.length, 'real topics to Firestore');
    } catch (err) {
        console.error('[HotTopics] Fatal error:', err);
    }
});

// Also expose as HTTP endpoint so you can trigger it manually
// GET https://us-central1-bitcoin-education-archive.cloudfunctions.net/refreshHotTopicsHttp
// Header: x-admin-token: $ADMIN_TOKEN
exports.refreshHotTopicsHttp = functions.https.onRequest(async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        const topics = await buildHotTopics();
        await db.collection('hotTopics').doc('latest').set({
            topics,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            version: 1,
        });
        res.json({ ok: true, topicsCount: topics.length, topics });
    } catch (err) {
        console.error('[HotTopics] HTTP trigger error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Manual force-refresh that bypasses the quality gate (admin use only)
exports.refreshHotTopicsForce = functions.https.onRequest(async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        const topics = await buildHotTopics();
        const passed = isRealTopics(topics);
        await db.collection('hotTopics').doc('latest').set({
            topics,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            version: 1,
            qualityGatePassed: passed,
        });
        res.json({ ok: true, topicsCount: topics.length, qualityGatePassed: passed, topics });
    } catch (err) {
        console.error('[HotTopics] Force refresh error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── Core builder ─────────────────────────────────────────────────────────────
async function buildHotTopics() {
    // Step 1: Discover trending Bitcoin topics from multiple sources
    const rawSignals = await gatherTrendingSignals();

    // Step 2: Cluster signals into 2-3 unified topic threads
    const topics = await clusterAndSummarize(rawSignals);

    return topics;
}

// ── Step 1: Gather raw trending signals ──────────────────────────────────────
// Phil's curated Bitcoin X list — 44 accounts
const CURATED_X_ACCOUNTS = [
    // OG thinkers / authors / podcasters
    'BigSeanHarris','francispouliot_','parkeralewis','TomerStrolight','MartyBent',
    'giacomozucco','ck_SNARKs','stephanlivera','Princey21M','real_vijay',
    'Erikcason','knutsvanholm','CedYoungelman','Bquittem','NeilJacobs',
    'jimmysong','gladstein','saifedean','JeffBooth','nvk',
    // Educators / media / builders
    'PlebUnderground','BitcoinPierre','w_s_bitcoin','HodlTarantula','parman_the',
    'LukeMikic21','denverbitcoin','Coinicarus','timevalueofbtc','CryptoCloaks',
    'IIICapital','_Checkmatey_','CitizenBitcoin','FractalEncrypt','Croesus_BTC',
    'hodlonaut','LynAldenContact','JoeConsorti','notgrubles',
    // Additional from screenshots
    'JoeCarlasare','thetrocro','TheGuySwann','jackmallers','BTCsessions',
];

async function gatherTrendingSignals() {
    const signals = [];
    const fetches = [
        fetchCuratedXPosts(),
        fetchRedditHot(),
        fetchBitcoinTalkHot(),
        fetchWebTrending(),
    ];
    const results = await Promise.allSettled(fetches);
    results.forEach((r, i) => {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
            signals.push(...r.value);
        } else {
            console.warn('[HotTopics] Source', i, 'failed:', r.reason);
        }
    });
    console.log('[HotTopics] Gathered', signals.length, 'raw signals');
    return signals;
}

// ── Reddit r/Bitcoin hot posts ────────────────────────────────────────────────
// ── Curated X accounts (Phil's Bitcoin list) ── search recent posts ──────────────
async function fetchCuratedXPosts() {
    const now = new Date();
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const dateStr = months[now.getUTCMonth()] + ' ' + now.getUTCFullYear();

    // Batch accounts into groups of 5 for OR queries
    const batches = [];
    for (let i = 0; i < CURATED_X_ACCOUNTS.length; i += 5) {
        batches.push(CURATED_X_ACCOUNTS.slice(i, i + 5));
    }

    const results = [];
    for (const batch of batches) {
        const usernameClause = batch.map(u => '@' + u).join(' OR ');
        const queries = [
            '(' + usernameClause + ') site:x.com ' + dateStr,
            '(' + usernameClause + ') bitcoin site:x.com ' + dateStr,
        ];
        for (const q of queries) {
            try {
                const items = await searchWeb(q, 3, 'pw');
                results.push(...items.map(r => ({ ...r, source: 'x' })));
            } catch (e) {
                console.warn('[HotTopics] Curated X search failed:', e.message);
            }
        }
    }

    // Deduplicate by URL
    const seen = new Set();
    return results.filter(r => {
        if (seen.has(r.url)) return false;
        seen.add(r.url);
        return true;
    });
}


async function fetchRedditHot() {
    const url = 'https://www.reddit.com/r/Bitcoin/hot.json?limit=25&raw_json=1';
    const resp = await fetch(url, {
        headers: {
            'User-Agent': 'BitcoinEducationArchive/1.0 (https://bitcoineducation.quest)',
            'Accept': 'application/json',
        },
    });
    if (!resp.ok) throw new Error('Reddit HTTP ' + resp.status);
    const json = await resp.json();
    if (!json.data || !json.data.children) throw new Error('Reddit: unexpected shape');

    return json.data.children
        .filter(p => p.data && !p.data.stickied && p.data.score > 100)
        .slice(0, 15)
        .map(p => ({
            source: 'reddit',
            title: p.data.title,
            url: 'https://reddit.com' + p.data.permalink,
            score: p.data.score,
            comments: p.data.num_comments,
            body: (p.data.selftext || '').substring(0, 300),
        }));
}

// ── BitcoinTalk board scraper (HTML) ──────────────────────────────────────────
async function fetchBitcoinTalkHot() {
    // Board 1 = Bitcoin Discussion. Scrape thread list HTML.
    const url = 'https://bitcointalk.org/index.php?board=1.0';
    const resp = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; BitcoinEducationArchive/1.0)',
            'Accept': 'text/html',
        },
    });
    if (!resp.ok) throw new Error('BitcoinTalk HTTP ' + resp.status);
    const html = await resp.text();

    // Extract thread titles + links from SMF board markup
    const threads = [];
    const re = /<span id="msg_\d+"><a href="(https:\/\/bitcointalk\.org\/index\.php\?topic=[^"]+)"[^>]*>([^<]+)<\/a><\/span>/g;
    let m;
    while ((m = re.exec(html)) !== null && threads.length < 20) {
        const title = m[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
        if (title.length > 10) {
            threads.push({
                source: 'bitcointalk',
                title,
                url: m[1],
                score: 50,
                comments: 0,
                body: '',
            });
        }
    }
    return threads;
}

// ── Web search for viral Bitcoin content ──────────────────────────────────────
async function fetchWebTrending() {
    // Build date-aware queries so results are inherently recent even without Brave freshness filter
    const now = new Date();
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const month = months[now.getUTCMonth()];
    const year = now.getUTCFullYear();
    const dateStr = month + ' ' + year; // e.g. 'June 2026'
    const queries = [
        // X/Twitter viral posts this week
        { q: 'bitcoin viral news controversy ' + dateStr, freshness: 'pw' },
        { q: 'bitcoin debate site:x.com OR site:twitter.com ' + dateStr, freshness: 'pw' },
        { q: 'bitcoin BIP proposal site:x.com ' + dateStr, freshness: 'pw' },
        // Reddit this week
        { q: 'bitcoin debate reddit.com/r/Bitcoin ' + dateStr, freshness: 'pw' },
        { q: 'bitcoin controversial trending reddit ' + dateStr, freshness: 'pw' },
        // General Bitcoin news/debate this week
        { q: 'bitcoin community debate controversy ' + dateStr, freshness: 'pw' },
        { q: 'bitcoin news controversy trending ' + dateStr, freshness: 'pw' },
        { q: 'bitcoin discussion bitcointalk.org ' + dateStr, freshness: 'pw' },
    ];

    const results = [];
    for (const entry of queries) {
        try {
            const items = await searchWeb(entry.q, 4, entry.freshness);
            results.push(...items);
        } catch (e) {
            console.warn('[HotTopics] Web search failed for:', entry.q, e.message);
        }
    }
    return results;
}

// Web search using your existing Brave Search worker
// freshness: 'pw' = past week, 'pd' = past day, 'pm' = past month
async function searchWeb(query, limit, freshness) {
    limit = limit || 5;
    freshness = freshness || 'pw'; // default: past week only
    const workerUrl = 'https://jolly-surf-219enacho-search.needcreations.workers.dev/search?q=' +
        encodeURIComponent(query) + '&count=' + limit + '&freshness=' + freshness;
    const resp = await fetch(workerUrl, { headers: { 'Accept': 'application/json' } });
    if (!resp.ok) throw new Error('Brave worker HTTP ' + resp.status);
    const json = await resp.json();
    return (json.results || []).slice(0, limit).map(r => ({
        source: 'web',
        title: r.title || '',
        url: r.url || '',
        score: 30,
        comments: 0,
        body: r.snippet || '',
    }));
}

// ── Step 2: Cluster + AI summarize ────────────────────────────────────────────
async function clusterAndSummarize(signals) {
    if (!signals.length) {
        return [{
            title: 'Bitcoin Community Updates',
            summary: 'No trending topics detected this week. Check back next Friday for the latest Bitcoin debates.',
            heatScore: 10,
            sides: [],
            posts: [],
        }];
    }

    // Build a compact signal digest for the AI prompt (keep token cost low)
    // Filter stale signals: only keep posts from current year or unverifiable sources (x/reddit)
    const currentYear = new Date().getUTCFullYear().toString();
    const freshSignals = signals.filter(s => {
        if (!s.url) return true; // keep if no URL
        // Always keep x-curated and reddit — they already have freshness=pw
        if (s.source === 'x' || s.source === 'reddit') return true;
        // For web/bitcointalk: only keep if URL contains current year or no year pattern
        const yearMatch = s.url.match(/20\d{2}/);
        if (!yearMatch) return true; // no year in URL, keep
        return yearMatch[0] === currentYear; // only keep if this year
    });
    // Deduplicate by title prefix (catches near-duplicate sources)
    const seenTitles = new Set();
    const dedupedSignals = freshSignals.filter(s => {
        const key = s.title.substring(0, 50).toLowerCase().replace(/[^a-z0-9]/g,'');
        if (seenTitles.has(key)) return false;
        seenTitles.add(key);
        return true;
    });
    const digest = dedupedSignals.slice(0, 60).map((s, i) =>
        (i + 1) + '. [' + (s.source === 'x' ? 'x-curated' : s.source) + '] ' + s.title + (s.body ? ' — ' + s.body.substring(0, 250) : '')
    ).join('\n');

    const prompt = `You are an expert Bitcoin analyst reviewing this week's most discussed and debated Bitcoin topics across Reddit, BitcoinTalk, X (Twitter), and the web.

IMPORTANT: Posts marked [x] are from a curated list of high-signal Bitcoin thought leaders including @MartyBent, @nvk, @jimmysong, @gladstein, @saifedean, @parkeralewis, @JeffBooth, @giacomozucco, @stephanlivera, @knutsvanholm and others. Weight these HEAVILY when identifying trending topics — if multiple of these accounts are discussing the same topic, it is almost certainly a hot topic this week.

Here are the raw post titles and snippets gathered this week (numbered for reference):

${digest}

KNOWN FACTS (use these — do not contradict or speculate):
- BIP-110 = a proposed temporary 1-year soft fork to restrict arbitrary data (Ordinals/inscriptions) in Bitcoin transactions. Author targets spam/non-monetary use. Miner signaling sits at ~0.3% as of June 2026. Chain split risk looms in August 2026.
- BIP-360 = Pay-to-Quantum-Resistant-Hash proposal to make Bitcoin outputs resistant to quantum computers. Proposed by Jameson Lopp.
- If a topic involves a BIP, state the BIP number and what it actually does — never invent a description.

STRICT RULES:
- NEVER invent a person's position. Only attribute a stance (FOR or AGAINST) to someone if a source above explicitly shows them arguing that position. If the sources are unclear, use "proponents argue..." or "critics argue..." without naming anyone.
- The FOR side and AGAINST side must cite DIFFERENT people. Never put the same person on both sides.
- If you cannot find clear evidence of who is FOR vs AGAINST from the sources, describe the positions in general terms — do not name names.
- Do not hallucinate quotes, positions, or names not present in the source data. This is the most important rule.

Your task: identify the 2-3 hottest, most technically specific, most contested Bitcoin topics from the sources above.

CRITICAL QUALITY RULES:
- Only output a topic if you have REAL signal from the sources above — specific claims, a named proposal, a named person, a concrete event, or a specific number/stat.
- If the sources only hint at a broad theme (e.g. "ETF" or "mining") with no specific debate, DO NOT output that as a topic — omit it entirely. 2 good topics beats 3 generic ones.
- NEVER write a topic summary like "The community is actively discussing X" or "Multiple perspectives are circulating" — those are filler and will be rejected. Every sentence must contain a specific fact, name, proposal, claim, or stat.
- If you genuinely cannot find 2 specific debated topics from the sources, output just 1. If none, output 0 topics with an empty array.

For each qualifying topic:
1. Write a neutral 3-sentence overview: name the specific proposal, actor, event, or claim. Use the KNOWN FACTS above if relevant. Be concrete — include names, numbers, dates.
2. Write 2-3 sentences for the FOR side: who supports it (only from sources), what specific benefits they cite, and what outcome they want.
3. Write 2-3 sentences for the AGAINST side: who opposes it (different people), what specific risks or objections they raise.
4. Assign a heatScore 1-100 based on controversy and community volume.

Do NOT include sources or URLs — those will be fetched separately. Focus on accuracy and specificity.

Return ONLY valid JSON, no markdown fences, no explanation outside the JSON:
{
  "topics": [
    {
      "title": "Punchy specific topic name (5 words max, include BIP number or protocol name if relevant)",
      "summary": "3-sentence neutral overview with specific names, proposals, or stats",
      "heatScore": 75,
      "sides": [
        { "stance": "for", "label": "The case FOR", "summary": "2-3 sentences with specific arguments and who makes them" },
        { "stance": "against", "label": "The case AGAINST", "summary": "2-3 sentences with specific objections and who raises them" }
      ],
      "postIndices": []
    }
  ]
}`;

    // AI priority: optional OpenAI/Anthropic keys → Cloudflare Workers AI (Llama 3.1) → keyword fallback
    const aiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
    let aiTopics = null;

    try {
        if (aiKey && aiKey.startsWith('sk-ant')) {
            aiTopics = await callClaude(prompt, aiKey);
        } else if (aiKey) {
            aiTopics = await callOpenAI(prompt, aiKey);
        } else {
            // Use Cloudflare Workers AI (Llama 3.1 8B) — free, already set up
            aiTopics = await callCloudflareLlama(prompt);
        }
    } catch (aiErr) {
        console.warn('[HotTopics] AI call failed, using keyword fallback:', aiErr.message);
        aiTopics = null;
    }

    if (!aiTopics || !aiTopics.topics) return fallbackCluster(signals);

    // Two-pass source attribution:
    // Pass 1 — AI identifies topics (no sources yet)
    // Pass 2 — targeted Brave search per topic to find real, on-topic sources
    // Sources only included if the search actually returns relevant results.
    // No sources > hallucinated sources.

    const topicResults = await Promise.all(aiTopics.topics.slice(0, 3).map(async t => {
        // Targeted search: use the topic title + key terms as the query
        const searchQuery = t.title + ' bitcoin ' + new Date().getUTCFullYear();
        let posts = [];
        try {
            const searchResults = await searchWeb(searchQuery, 6, 'pm');
            // Filter: only include results whose title/snippet meaningfully relate to the topic
            // Simple relevance check: at least one key word from topic title appears in result
            const topicWords = t.title.toLowerCase()
                .replace(/[^a-z0-9 ]/g, '')
                .split(' ')
                .filter(w => w.length > 3); // skip short/stop words
            const relevant = searchResults.filter(r => {
                const text = (r.title + ' ' + r.body).toLowerCase();
                return topicWords.some(w => text.includes(w));
            });
            posts = relevant
                .filter(s => s.source !== 'bitcointalk')
                .slice(0, 4)
                .map(s => ({ source: s.source, title: s.title, url: s.url }));
        } catch (e) {
            console.warn('[HotTopics] Source search failed for "' + t.title + '":', e.message);
            // posts stays empty — no sources beats wrong sources
        }

        // Collect @usernames from the targeted sources for attribution sanitization
        const sourcedNames = new Set();
        posts.forEach(p => {
            const m = (p.title + ' ' + p.url).match(/@([A-Za-z0-9_]+)/g) || [];
            m.forEach(n => sourcedNames.add(n.toLowerCase()));
        });
        // Also pull names from any original signals that matched this topic by postIndices
        (t.postIndices || []).slice(0, 8).forEach(idx => {
            const s = dedupedSignals[idx - 1];
            if (!s) return;
            const m = (s.title + ' ' + (s.body || '')).match(/@([A-Za-z0-9_]+)/g) || [];
            m.forEach(n => sourcedNames.add(n.toLowerCase()));
        });

        // Sanitize sides: strip @mentions that aren\'t backed by a source
        const sanitizeSide = (text) => {
            if (!text) return text;
            return text.replace(/@([A-Za-z0-9_]+)/g, (match) => {
                if (sourcedNames.has(match.toLowerCase())) return match;
                return 'some community members';
            });
        };

        const sides = (t.sides || []).slice(0, 2).map(side => ({
            ...side,
            summary: sanitizeSide(side.summary),
        }));

        return {
            title: t.title || 'Hot Bitcoin Topic',
            summary: t.summary || '',
            heatScore: Math.min(100, Math.max(0, t.heatScore || 50)),
            sides,
            posts, // empty array = no sources shown; that's fine and honest
        };
    }));

    return topicResults;
}

// Call Cloudflare Workers AI (Llama 4 Scout) via REST — uses existing CF_ACCOUNT_ID + CF_API_TOKEN
async function callCloudflareLlama(prompt) {
    const accountId = process.env.CF_ACCOUNT_ID;
    const apiToken = process.env.CF_AI_TOKEN; // Workers AI token (separate from CDN token)
    if (!accountId || !apiToken) throw new Error('Missing CF_ACCOUNT_ID or CF_API_TOKEN');
    const url = 'https://api.cloudflare.com/client/v4/accounts/' + accountId +
        '/ai/run/@cf/meta/llama-4-scout-17b-16e-instruct';
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + apiToken,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            messages: [
                { role: 'system', content: 'You are a Bitcoin analyst. Return only valid JSON, no markdown fences, no explanation outside the JSON. Be specific and concrete — never output filler summaries like "the community is discussing X". Every sentence must contain a real fact, name, proposal, claim, or statistic from the provided sources.' },
                { role: 'user', content: prompt },
            ],
            max_tokens: 3000,
        }),
    });
    if (!resp.ok) {
        const errText = await resp.text();
        throw new Error('CF Workers AI HTTP ' + resp.status + ': ' + errText.substring(0, 200));
    }
    const json = await resp.json();
    // Extract text — handle multiple CF Workers AI response shapes:
    // Llama 4 Scout: json.result.response (object already parsed)
    // Llama 3.x openai-compat: json.result.choices[0].message.content (string)
    // Fallback: json.choices, json.result as string
    let parsed = null;
    if (json.result && json.result.response && typeof json.result.response === 'object') {
        // Llama 4 Scout returns parsed JSON object directly in result.response
        parsed = json.result.response;
    } else {
        const text =
            (json.result && json.result.choices && json.result.choices[0] && json.result.choices[0].message && json.result.choices[0].message.content) ||
            (json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) ||
            (typeof json.result === 'string' ? json.result : null) ||
            (typeof json.result?.response === 'string' ? json.result.response : null);
        if (!text) throw new Error('CF Workers AI: no text in response — ' + JSON.stringify(json).substring(0, 300));
        // Strip markdown fences if present
        const cleaned = String(text).replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
        // Fix unquoted keys just in case
        const fixedJson = cleaned.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
        parsed = JSON.parse(fixedJson);
    }
    return parsed;
}

async function callClaude(prompt, apiKey) {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1200,
            messages: [{ role: 'user', content: prompt }],
        }),
    });
    if (!resp.ok) throw new Error('Claude HTTP ' + resp.status);
    const json = await resp.json();
    const text = json.content && json.content[0] && json.content[0].text;
    return JSON.parse(text);
}

async function callOpenAI(prompt, apiKey) {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + apiKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 1200,
            temperature: 0.3,
            messages: [{ role: 'user', content: prompt }],
        }),
    });
    if (!resp.ok) throw new Error('OpenAI HTTP ' + resp.status);
    const json = await resp.json();
    const text = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
    return JSON.parse(text);
}

// Fallback: no AI key — group by keyword, pick top 3 clusters
function fallbackCluster(signals) {
    const keywords = ['BIP', 'lightning', 'fee', 'halving', 'ETF', 'mining', 'taproot', 'fork', 'ordinals', 'layer 2'];
    const clusters = {};
    signals.forEach(s => {
        const titleLower = s.title.toLowerCase();
        let matched = false;
        for (const kw of keywords) {
            if (titleLower.includes(kw.toLowerCase())) {
                clusters[kw] = clusters[kw] || [];
                clusters[kw].push(s);
                matched = true;
                break;
            }
        }
        if (!matched) {
            clusters['General'] = clusters['General'] || [];
            clusters['General'].push(s);
        }
    });

    return Object.entries(clusters)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 3)
        .map(([kw, posts]) => ({
            title: kw + ' Discussion',
            summary: 'The Bitcoin community is actively discussing ' + kw + ' this week. Multiple perspectives are circulating across Reddit, BitcoinTalk, and social media.',
            heatScore: Math.min(90, posts.length * 10),
            sides: [
                { stance: 'for', label: 'Supporters say', summary: 'Community members see positive developments and opportunities in recent ' + kw + ' discussions.' },
                { stance: 'against', label: 'Critics say', summary: 'Others raise concerns and call for more caution or analysis before drawing conclusions.' },
            ],
            posts: posts.slice(0, 4).map(p => ({ source: p.source, title: p.title, url: p.url })),
        }));
}
// ─────────────────────────────────────────────────────────────────────────────
// END HOT TOPICS
// ─────────────────────────────────────────────────────────────────────────────

// ── Satoshi's Favor → X auto-post ────────────────────────────────────────────
const { tweetSatoshisFavor } = require('./src/tweetSatoshisFavor');
exports.tweetSatoshisFavor = tweetSatoshisFavor;

// ── GIF Search Proxy (Tenor v2) ───────────────────────────────────────────────
// Proxies Tenor v2 requests server-side so the API key never leaks to the client
// and no browser-side API activation is required.
exports.searchGifs = functions.https.onCall(async (data, context) => {
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
        throw new functions.https.HttpsError('internal', 'GIF search failed');
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

// ===== PVP LOBBY CLEANUP =====
// Runs every 10 minutes. Deletes pvp_lobby docs whose lastSeen is older than
// 60 seconds (2x the client heartbeat interval of 5s, well beyond the 30s
// stale threshold). Prevents stale lobby docs from blocking matchmaking.
exports.cleanupExpiredLobbies = functions.pubsub.schedule('every 60 minutes').timeZone('UTC').onRun(async (ctx) => {
    const STALE_MS = 60 * 1000; // 60 seconds
    const cutoff = Date.now() - STALE_MS;
    try {
        const snap = await db.collection('pvp_lobby').get();
        const batch = db.batch();
        let count = 0;
        snap.forEach(doc => {
            const d = doc.data();
            // Delete if: no lastSeen, OR lastSeen is stale
            if (!d.lastSeen || d.lastSeen < cutoff) {
                batch.delete(doc.ref);
                count++;
            }
        });
        if (count > 0) {
            await batch.commit();
            console.log('[PVP CLEANUP] Deleted', count, 'stale lobby docs');
        } else {
            console.log('[PVP CLEANUP] No stale lobby docs found');
        }
    } catch (e) {
        console.error('[PVP CLEANUP] Error:', e.message);
    }
    return null;
});

// ===== COUNTRY STATS AGGREGATION =====
// Fires when a user document is written. If country changed, updates stats/countries
// with atomic increments so the world map always has fresh data.
exports.updateCountryStats = functions.firestore
    .document('users/{userId}')
    .onWrite(async (change, context) => {
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
