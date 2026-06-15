const functions = require('firebase-functions');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const { authenticator } = require("otplib");
const QRCode = require('qrcode');
const fetch = require('node-fetch');

admin.initializeApp();
const db = admin.firestore();

// HTML escape for server-side email/notification content
function _escHtml(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

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
exports.streakReminder = onSchedule({ schedule: '0 20 * * *', timeZone: 'UTC' }, async (event) => {
        const today = new Date().toISOString().split('T')[0];

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

    const invoice = (data.invoice || '').trim();

    // 3. NWC configuration check
    if (!FAUCET.NWC_URL) {
        console.error('[FAUCET] NWC_URL not configured');
        return { success: false, error: 'Faucet not configured. Contact admin.' };
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

            // Check points balance (points are NEVER deducted - we track pointsClaimed separately)
            const userPoints = user.points || 0;
            const pointsClaimed = user.pointsClaimed || 0;
            const availablePoints = userPoints - pointsClaimed;
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
        'flex_action': 5,              // Daily FLEX healthy action (one per action-id per day)
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

        'flex_action': ['💪 flex:'],
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

    const absMax = (matchedAction === 'badge_earned') ? 30000 : 2200;
    if (pts < 0 || pts > absMax) {
        return { success: false, error: 'Invalid points amount' };
    }
    if (pts === 0 && !tickets && !streakFreezes && !channelId) {
        return { success: false, error: 'Nothing to award' };
    }

    const reason = action;

    // ── ATOMIC UPDATES ──
    const DAILY_CAP = 500;
    const today = new Date().toISOString().split('T')[0];
    const userRef = db.collection('users').doc(uid);
    const dailyPtsRef = userRef.collection('daily_points').doc(today);

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
            // 1. Check Cooldown (Atomic)
            if (cooldownRef) {
                const cooldownDoc = await t.get(cooldownRef);
                if (cooldownDoc.exists) {
                    const lastAction = cooldownDoc.data().ts;
                    const lastTime = lastAction ? (lastAction.toDate ? lastAction.toDate() : new Date(lastAction)) : null;
                    const cooldownMs = ACTION_COOLDOWNS[matchedAction];
                    if (lastTime && (Date.now() - lastTime.getTime()) < cooldownMs) {
                        throw new Error('TOO_FAST');
                    }
                }
            }

            // 1a. Badge dedup - each badge can only award XP once per user, ever
            // Use badgeKnown (set only when badge is in BADGE_VALUES catalog) so that
            // omitting badgeId can no longer bypass this guard (exploit B).
            if (badgeKnown) {
                const badgeAwardRef = userRef.collection('badge_awards').doc(badgeId);
                const badgeAwardDoc = await t.get(badgeAwardRef);
                if (badgeAwardDoc.exists) {
                    throw new Error('BADGE_ALREADY_AWARDED:' + badgeId);
                }
                // Stamp it inside the transaction so concurrent calls can't double-award
                t.set(badgeAwardRef, { awardedAt: admin.firestore.FieldValue.serverTimestamp(), action });
                // [AUDIT FIX H-2] Write visibleBadges server-side (blocked from client in rules)
                t.update(userRef, { visibleBadges: admin.firestore.FieldValue.arrayUnion(badgeId) });
            }

            // 1c. Daily dedup for trivia and poll - one award per UTC day per action
            // Uses daily_action_counts subcollection (CF-only, rules block client writes)
            if (matchedAction === 'trivia_correct' || matchedAction === 'trivia_attempt') {
                const triviaRef = userRef.collection('daily_action_counts').doc(today + '_trivia');
                const triviaDoc = await t.get(triviaRef);
                if (triviaDoc.exists) {
                    throw new Error('ALREADY_CLAIMED_TODAY:trivia');
                }
                t.set(triviaRef, { awardedAt: admin.firestore.FieldValue.serverTimestamp(), action: matchedAction });
            }
            if (matchedAction === 'poll_vote') {
                const pollRef = userRef.collection('daily_action_counts').doc(today + '_poll_vote');
                const pollDoc = await t.get(pollRef);
                if (pollDoc.exists) {
                    throw new Error('ALREADY_CLAIMED_TODAY:poll');
                }
                t.set(pollRef, { awardedAt: admin.firestore.FieldValue.serverTimestamp(), action: matchedAction });
            }
            // 1d. Daily dedup for FLEX - one award per action-id per UTC day
            if (matchedAction === 'flex_action') {
                const flexId = (data.flexActionId || '').replace(/[^a-z0-9_]/g, '').substring(0, 30);
                if (!flexId) throw new Error('FLEX_MISSING_ACTION_ID');
                const flexRef = userRef.collection('daily_action_counts').doc(today + '_flex_' + flexId);
                const flexDoc = await t.get(flexRef);
                if (flexDoc.exists) {
                    throw new Error('ALREADY_CLAIMED_TODAY:flex_' + flexId);
                }
                t.set(flexRef, { awardedAt: admin.firestore.FieldValue.serverTimestamp(), action: 'flex_action', flexId });
            }

            // 1b. Check per-day action count (anti-spam)
            let dailyActionUsed = 0;
            if (dailyActionRef) {
                const dailyActionDoc = await t.get(dailyActionRef);
                dailyActionUsed = dailyActionDoc.exists ? (dailyActionDoc.data().count || 0) : 0;
                const limit = ACTION_DAILY_LIMITS[matchedAction];
                if (dailyActionUsed >= limit) {
                    throw new Error('DAILY_ACTION_LIMIT:' + matchedAction + ':' + limit);
                }
            }

            const userDoc = await t.get(userRef);
            if (!userDoc.exists) throw new Error('User not found');
            const userData = userDoc.data();

            // 2. Throttling for Daily Tickets (Server-side Fix)
            if (matchedAction === 'daily_tickets' || (action && action.includes('Daily tickets'))) {
                if (userData.lastTicketDate === today) {
                    throw new Error('ALREADY_CLAIMED_TODAY');
                }
            }

            // 3. Daily Cap Logic (affects points only, NOT channel tracking)
            const dailyDoc = await t.get(dailyPtsRef);
            const dailyUsed = dailyDoc.exists ? (dailyDoc.data().total || 0) : 0;

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
            if (pendingOverflow > 0 && lastOverflowDate && lastOverflowDate !== today) {
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
                userUpdate.lastOverflowDate = today;
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
        if (e.message === 'ALREADY_CLAIMED_TODAY') {
            return { success: false, error: 'Daily tickets already claimed today.' };
        }
        console.error('[AWARD_POINTS_TRANS_ERR]', e);
        return { success: false, error: e.message || 'Internal error' };
    }

    // (dead-code block below removed 2026-04-16 - was a leftover from a pre-refactor commit that prevented Cloud Functions deploys)
});

// ===== FAUCET ADMIN - getFaucetStats =====
exports.getFaucetStats = functions.https.onCall(async (data, context) => {
    if (!context.auth || ['needcreations@gmail.com','info.603btc@gmail.com'].indexOf(context.auth.token.email) === -1) {
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
    if (!context.auth || ['needcreations@gmail.com','info.603btc@gmail.com'].indexOf(context.auth.token.email) === -1) {
        throw new functions.https.HttpsError('permission-denied', 'Admin only');
    }
    const paused = !!data.paused;
    await db.collection('faucet_config').doc('settings').set({ paused: paused }, { merge: true });
    return { success: true, paused: paused };
});

// ===== ONE-TIME: Backfill bestStreak for all users =====
exports.backfillBestStreak = functions.https.onCall(async (data, context) => {
    if (!context.auth || ['needcreations@gmail.com','info.603btc@gmail.com'].indexOf(context.auth.token.email) === -1) {
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
    if (!context.auth || (context.auth.token.email !== 'needcreations@gmail.com' && context.auth.token.email !== 'info.603btc@gmail.com')) {
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

            const today = new Date().toISOString().split('T')[0];
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

        // Read answer key from server-only collection (or fallback to match doc for legacy matches)
        let correctAnswer;
        const keyDoc = await tx.get(db.collection('pvp_answer_keys').doc(matchId));
        if (keyDoc.exists && keyDoc.data().keys && keyDoc.data().keys[questionIndex] !== undefined) {
            correctAnswer = keyDoc.data().keys[questionIndex].correct;
        } else {
            // Legacy fallback - old matches still have correct in the match doc
            correctAnswer = question.correct;
        }

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
        return { success: true, correct: isCorrect };
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

    // Include correct answer index so clients can verify answers locally
    const clientQuestions = questions.map(q => ({
        q: q.q,
        options: q.options,
        correct: q.correct
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
    const today = new Date().toISOString().split('T')[0];
    const dailyQuestRef = userRef.collection('daily_action_counts').doc(today + '_quest');
    const dailyPtsRef = userRef.collection('daily_points').doc(today);

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
                userUpdate.lastOverflowDate = today;
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

// New user doc created → bump userCount
exports.onUserDocCreated = functions.firestore
    .document('users/{uid}')
    .onCreate(async (_snap, _context) => {
        try {
            await db.collection('stats').doc('global').set({
                userCount: admin.firestore.FieldValue.increment(1)
            }, { merge: true });
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
    if (email !== 'needcreations@gmail.com' && email !== 'info.603btc@gmail.com') {
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
// Usage: curl "https://us-central1-bitcoin-education-archive.cloudfunctions.net/dailyActiveUsers?t=dau-2026"
// ───────────────────────────────────────────────────────────────
exports.dailyActiveUsers = functions.https.onRequest(async (req, res) => {
    // Lightweight token gate (readonly, but avoids drive-by polling).
    const token = req.query.t || req.headers['x-dau-token'];
    if (token !== 'dau-2026') {
        res.status(403).json({ error: 'forbidden' }); return;
    }
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
    const token = req.query.t || req.headers['x-dau-token'];
    if (token !== 'dau-2026') { res.status(403).json({ error: 'forbidden' }); return; }
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
    const token = req.query.t || req.headers['x-dau-token'];
    if (token !== 'dau-2026') { res.status(403).json({ error: 'forbidden' }); return; }

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
    const token = req.query.t || req.headers['x-dau-token'];
    if (token !== 'dau-2026') { res.status(403).json({ error: 'forbidden' }); return; }

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
    if (req.query.t !== 'dau-2026') return res.status(403).send('no');
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
    if (req.query.t !== 'dau-2026') return res.status(403).send('no');
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
exports.adminUnbanUser = functions.https.onRequest(async (req, res) => {
    if (req.query.t !== 'dau-2026') return res.status(403).send('no');
    try {
        const uid = req.query.uid;
        if (!uid) return res.status(400).json({error: 'uid required'});
        await db.collection('users').doc(uid).update({
            withdrawals_disabled: false,
            satsDisabled: false,
            flagged: false,
            flag_reason: admin.firestore.FieldValue.delete(),
            ban_reason: admin.firestore.FieldValue.delete(),
            _pendingClaim: admin.firestore.FieldValue.delete(),
        });
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
        // Reset
        await stateRef.set({
            points: 0,
            favorActive: false,
            favorStart: null,
            favorEndBase: null,
            bonusMinutes: 0,
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
        const userUpdate = {
            pointsDonated: admin.firestore.FieldValue.increment(amount),
        };
        if (newBadges.length > 0) {
            userUpdate.donationBadges = admin.firestore.FieldValue.arrayUnion(...newBadges);
            userUpdate.points = admin.firestore.FieldValue.increment(bonusPts);
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
        tx.update(statsRef, statsUpdate);
    });

    return { success: true, newBadges, bonusPts };
});

// ===== LEADERBOARD USER SEARCH =====
// Fetches top users ordered by points, filters by substring match (case-insensitive),
// returns matched users with their true rank. Supports cursor-based pagination.
exports.searchUsers = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');

    const query = ((data.query || '').trim()).toLowerCase();
    if (!query || query.length < 2) return { users: [], hasMore: false };

    const pageSize = parseInt(data.pageSize) || 10;
    const afterRank = parseInt(data.afterRank) || 0; // cursor: skip users already returned

    // Fetch users ordered by points desc
    // We scan up to 5000 users to find substring matches - sufficient for this app's scale
    const SCAN_LIMIT = 5000;
    const snap = await db.collection('users')
        .where('points', '>', 0)
        .orderBy('points', 'desc')
        .limit(SCAN_LIMIT)
        .get();

    // Build ranked list with substring filter
    const matched = [];
    let rank = 0;
    snap.forEach(doc => {
        rank++;
        const d = doc.data();
        if (d.ghostMode) return; // respect ghost mode
        const name = (d.username || '').toLowerCase();
        if (!name.includes(query)) return;
        matched.push({
            uid: doc.id,
            username: d.username || 'Anon',
            points: d.points || 0,
            rank,
            faction: d.faction || null,
            country: d.country || null,
            lightningAddress: d.lightningAddress || d.lightning || null,
        });
    });

    // Pagination: skip already-seen results by rank cursor
    const page = afterRank > 0 ? matched.filter(u => u.rank > afterRank) : matched;
    const results = page.slice(0, pageSize);
    const hasMore = page.length > pageSize;

    return { users: results, hasMore };
});

