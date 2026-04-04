const functions = require('firebase-functions');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const { authenticator } = require("otplib");
const QRCode = require('qrcode');
const fetch = require('node-fetch');

admin.initializeApp();
const db = admin.firestore();

const { NWCClient } = require('@getalby/sdk');

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
    NWC_URL: 'nostr+walletconnect://d6d1a27fc9b9ec29af7a655866c875882478d44e7b626bf59744680f3c92e53b?relay=wss://relay.getalby.com/v1&secret=88d7d3dd102b6db91291b9b178a570724aff497933e80fdaa27aff01346d25b2'
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
    
    const doc = await db.collection('totp_secrets').doc(uid).get();
    if (!doc.exists || !doc.data().enabled) {
        throw new functions.https.HttpsError('not-found', 'TOTP not enabled');
    }
    
    const secret = doc.data().secret;
    var isValid = authenticator.verify({ token: data.code, secret: secret });
    
    if (!isValid) throw new functions.https.HttpsError('invalid-argument', 'Invalid code');
    
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
        
        // Use the client-provided event ID first (Alby/extensions compute this correctly)
        // Fall back to our own computation if client didn't provide one
        const clientId = (nostrEvent.id && /^[a-f0-9]{64}$/.test(nostrEvent.id)) ? nostrEvent.id : null;
        
        // Get the actual signature — prefer from the event object itself
        const actualSig = (nostrEvent.sig && /^[a-f0-9]{128}$/.test(nostrEvent.sig)) ? nostrEvent.sig : sig;
        
        // Verify signature using schnorr
        const sigBytes = Buffer.from(actualSig, 'hex');
        const pubkeyBytes = Buffer.from(pubkey, 'hex');
        
        let valid = false;
        // Try client event ID first (most reliable — matches what the extension signed)
        if (clientId) {
            try {
                valid = secp.schnorr.verifySync(sigBytes, Buffer.from(clientId, 'hex'), pubkeyBytes);
            } catch(e1) { /* try next */ }
        }
        // Try our computed event ID
        if (!valid) {
            try {
                valid = secp.schnorr.verifySync(sigBytes, Buffer.from(eventId, 'hex'), pubkeyBytes);
            } catch(e2) { /* try next */ }
        }
        // Last resort: try verifying against raw sig hash (some older extensions)
        if (!valid && sig !== actualSig) {
            try {
                const altSigBytes = Buffer.from(sig, 'hex');
                valid = secp.schnorr.verifySync(altSigBytes, Buffer.from(clientId || eventId, 'hex'), pubkeyBytes);
            } catch(e3) { /* give up */ }
        }
        
        if (!valid) {
            console.error('Nostr sig verify FAILED. clientId:', clientId ? clientId.substring(0,16) : 'none', 'computedId:', eventId.substring(0,16), 'sigLen:', actualSig.length, 'pubkey:', pubkey.substring(0,16));
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
// LNURL-auth — Lightning Login
// =============================================

// Step 1: Generate a challenge (k1) and return LNURL
exports.lnAuthChallenge = functions.https.onCall(async (data, context) => {
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

// Step 2: HTTP callback endpoint — wallet calls this with sig + key
exports.lnAuthCallback = functions.https.onRequest(async (req, res) => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');

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

    // Signature valid — mark challenge as completed with the linking key
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
    await db.collection('lnauth_challenges').doc(k1).update({
        status: 'completed',
        linkingKey: key,
        uid: lnUid,
        token: customToken,
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

    const doc = await db.collection('lnauth_challenges').doc(k1).get();
    if (!doc.exists) {
        throw new functions.https.HttpsError('not-found', 'Challenge not found');
    }

    const challenge = doc.data();
    if (challenge.status !== 'completed') {
        throw new functions.https.HttpsError('not-found', 'Not yet authenticated');
    }

    // Clean up the challenge doc (one-time use)
    await db.collection('lnauth_challenges').doc(k1).delete();

    return { token: challenge.token, uid: challenge.uid };
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
// Forum Post Notification — email admin on new post
// =============================================
exports.onForumPost = functions.firestore
    .document('forum_posts/{postId}')
    .onCreate(async (snap, context) => {
        const post = snap.data();
        const postId = context.params.postId;

        // Send notification email via Firebase's built-in mail
        // Using a simple HTTPS fetch to a mail service
        // For now, store in a notifications collection for polling
        // OR use nodemailer if SMTP is configured

        try {
            // Store notification for admin
            await db.collection('admin_notifications').add({
                type: 'forum_post',
                postId: postId,
                title: post.title || '',
                author: post.authorName || 'Unknown',
                category: post.category || 'general',
                body: (post.body || '').substring(0, 200),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false
            });

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
                            '<h3 style="color:#fff;margin:0 0 8px;">' + (post.title || 'Untitled') + '</h3>' +
                            '<div style="color:#aaa;font-size:0.9rem;">By: ' + (post.authorName || 'Unknown') + ' · Category: ' + (post.category || 'general') + '</div>' +
                            (post.body ? '<p style="color:#ccc;margin-top:12px;">' + (post.body || '').substring(0, 300) + (post.body.length > 300 ? '...' : '') + '</p>' : '') +
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
// Nacho Feedback Report — runs daily, reports every 100 interactions
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
    
    // Check if the referred user meets qualification criteria
    const referredUser = await db.collection('users').doc(referredUid).get();
    if (!referredUser.exists) throw new functions.https.HttpsError('not-found', 'User not found');
    
    const userData = referredUser.data();
    const points = userData.points || 0;
    const channelsVisited = (userData.visitedChannels || []).length;
    
    // Qualification: at least 100 points and 5 channels visited
    if (points < 100 || channelsVisited < 5) {
        return { success: false, reason: 'Keep learning! You need 100+ points and 5+ channels visited.' };
    }
    
    // Mark referral as verified and award tickets to referrer
    const batch = db.batch();
    
    // Update referral doc
    batch.update(referralDoc.ref, {
        verified: true,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        ticketsAwarded: true
    });
    
    // Award 50 tickets to the referrer (using admin SDK bypasses rules)
    batch.update(db.collection('users').doc(referrerUid), {
        tickets: admin.firestore.FieldValue.increment(50),
        referralTicketsEarned: admin.firestore.FieldValue.increment(50)
    });
    
    // Award 25 tickets to the referred user too
    batch.update(db.collection('users').doc(referredUid), {
        tickets: admin.firestore.FieldValue.increment(25)
    });
    
    await batch.commit();
    
    return { success: true, referrerTickets: 50, referredTickets: 25 };
});

// =============================================
// AUDIT FIX: Server-Side Points Validation
// High-value point awards go through this function
// Prevents client-side point farming
// =============================================
exports.awardPoints = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    
    const uid = context.auth.uid;
    const reason = data.reason || '';
    const amount = parseInt(data.amount) || 0;
    
    // Define allowed point values per reason
    const allowedAwards = {
        'exam_pass': 500,
        'quest_complete': 200,
        'referral_bonus': 100,
        'scholar_cert': 1000,
        'daily_challenge': 50,
    };
    
    if (!allowedAwards[reason]) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid award reason');
    }
    
    const awardAmount = allowedAwards[reason];
    
    // Rate limiting: check last award time for this reason
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) throw new functions.https.HttpsError('not-found', 'User not found');
    
    const userData = userDoc.data();
    const now = Date.now();
    const lastAwards = userData.lastAwards || {};
    const lastAwardTime = lastAwards[reason] || 0;
    
    // Cooldowns per reason
    const cooldowns = {
        'exam_pass': 86400000,      // 24 hours
        'quest_complete': 3600000,   // 1 hour
        'referral_bonus': 0,         // No cooldown (one-time per referral)
        'scholar_cert': 86400000,    // 24 hours
        'daily_challenge': 86400000, // 24 hours
    };
    
    if (now - lastAwardTime < cooldowns[reason]) {
        throw new functions.https.HttpsError('resource-exhausted', 'Too soon. Try again later.');
    }
    
    // Award points
    await db.collection('users').doc(uid).update({
        points: admin.firestore.FieldValue.increment(awardAmount),
        [`lastAwards.${reason}`]: now
    });
    
    // Log the award for audit trail
    await db.collection('point_awards').add({
        uid: uid,
        reason: reason,
        amount: awardAmount,
        ts: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true, awarded: awardAmount };
});

// =============================================
// AUDIT FIX: Server-Side Daily Limit Check
// Spin wheel, scholar exam, quest attempts
// =============================================
exports.checkDailyLimit = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    
    const uid = context.auth.uid;
    const action = data.action || '';
    const today = new Date().toISOString().split('T')[0];
    
    const allowedActions = {
        'spin': { max: 1, field: 'lastSpinDate' },
        'scholar_exam': { max: 1, field: 'lastScholarDate' },
        'quest': { max: 3, field: 'questDate', countField: 'questCountToday' }
    };
    
    if (!allowedActions[action]) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid action');
    }
    
    const config = allowedActions[action];
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) throw new functions.https.HttpsError('not-found', 'User not found');
    
    const userData = userDoc.data();
    const lastDate = userData[config.field] || '';
    
    if (config.countField) {
        // Count-based limit (quests)
        const count = (lastDate === today) ? (userData[config.countField] || 0) : 0;
        if (count >= config.max) {
            return { allowed: false, reason: 'Daily limit reached (' + config.max + '/' + config.max + ')' };
        }
        // Increment count
        await db.collection('users').doc(uid).update({
            [config.field]: today,
            [config.countField]: (lastDate === today) ? admin.firestore.FieldValue.increment(1) : 1
        });
    } else {
        // Simple date-based limit (spin, exam)
        if (lastDate === today) {
            return { allowed: false, reason: 'Already done today. Come back tomorrow!' };
        }
        await db.collection('users').doc(uid).update({
            [config.field]: today
        });
    }
    
    return { allowed: true };
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
    if (!data.text && !data.gifUrl && !data.imageUrl && !data.imageBase64 && !data.user) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing content');
    }

    // Rate limit: 1 bridge call per 3 seconds per user
    const uid = context.auth.uid;
    const rateLimitRef = db.collection('rate_limits').doc('bridge_' + uid);
    const rateLimitDoc = await rateLimitRef.get();
    if (rateLimitDoc.exists) {
        const lastCall = rateLimitDoc.data().lastCall;
        if (lastCall && Date.now() - lastCall.toDate().getTime() < 3000) {
            throw new functions.https.HttpsError('resource-exhausted', 'Too fast — wait 3 seconds');
        }
    }
    await rateLimitRef.set({ lastCall: admin.firestore.FieldValue.serverTimestamp() });

    // Secret lives ONLY in server-side environment variables (.env)
    const BRIDGE_URL = process.env.BRIDGE_URL || 'https://chat-bridge.needcreations.workers.dev/webhook/firestore';
    const BRIDGE_SECRET = process.env.BRIDGE_SECRET;

    if (!BRIDGE_SECRET) {
        console.error('[BRIDGE] No bridge secret configured — run: firebase functions:config:set bridge.secret="YOUR_SECRET"');
        return { ok: false, error: 'Bridge not configured' };
    }

    try {
        const fetch = require('node-fetch');
        const resp = await fetch(BRIDGE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + BRIDGE_SECRET
            },
            body: JSON.stringify({
                user: (data.user || data.name || 'Anon').substring(0, 50),
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
        return { ok: json.ok || false };
    } catch(e) {
        console.error('[BRIDGE] Error:', e.message);
        return { ok: false };
    }
});

// ===== SATS FAUCET — claimSats Cloud Function =====
exports.claimSats = functions.https.onCall(async (data, context) => {
    // 1. Must be authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const uid = context.auth.uid;
    const email = context.auth.token.email;
    const emailVerified = context.auth.token.email_verified;

    // 2. Must not be anonymous
    if (!email || !emailVerified) {
        return { success: false, error: 'Verified email required. Link and verify your email in Account settings.' };
    }

    const amount = parseInt(data.amount);
    const invoice = (data.invoice || '').trim();

    // 3. Validate inputs
    if (!invoice || !invoice.toLowerCase().startsWith('lnbc')) {
        return { success: false, error: 'Invalid Lightning invoice. Must start with lnbc.' };
    }
    if (isNaN(amount) || amount < FAUCET.MIN_WITHDRAWAL_SATS) {
        return { success: false, error: 'Minimum claim is ' + FAUCET.MIN_WITHDRAWAL_SATS + ' sats.' };
    }
    if (amount > FAUCET.MAX_PER_CLAIM_SATS) {
        return { success: false, error: 'Maximum claim is ' + FAUCET.MAX_PER_CLAIM_SATS + ' sats per transaction.' };
    }

    // 4. Load user data
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
        return { success: false, error: 'User profile not found.' };
    }
    const user = userDoc.data();

    // 5. Check account age
    const createdAt = context.auth.token.auth_time ? new Date(context.auth.token.auth_time * 1000) : null;
    // Use Firestore createdAt if available
    const userCreated = user.createdAt ? (user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt)) : null;
    const accountDate = userCreated || createdAt;
    if (accountDate) {
        const ageDays = Math.floor((Date.now() - accountDate.getTime()) / 86400000);
        if (ageDays < FAUCET.MIN_ACCOUNT_AGE_DAYS) {
            return { success: false, error: 'Account must be at least ' + FAUCET.MIN_ACCOUNT_AGE_DAYS + ' days old. Yours is ' + ageDays + ' days.' };
        }
    }

    // 6. Check channels read
    const channelsRead = user.readChannels ? Object.keys(user.readChannels).length : 0;
    if (channelsRead < FAUCET.MIN_CHANNELS_READ) {
        return { success: false, error: 'Must read at least ' + FAUCET.MIN_CHANNELS_READ + ' channels. You have read ' + channelsRead + '.' };
    }

    // 7. Check points balance
    const userPoints = user.points || 0;
    const satsBalance = Math.floor(userPoints / FAUCET.POINTS_PER_SAT);
    if (satsBalance < amount) {
        return { success: false, error: 'Insufficient points. You have ' + satsBalance + ' sats worth (' + userPoints + ' points).' };
    }

    // 8. Check lifetime cap
    const satsWithdrawn = user.satsWithdrawn || 0;
    if (satsWithdrawn + amount > FAUCET.MAX_LIFETIME_PER_USER_SATS) {
        const remaining = FAUCET.MAX_LIFETIME_PER_USER_SATS - satsWithdrawn;
        return { success: false, error: 'Lifetime cap reached. You can withdraw ' + remaining + ' more sats.' };
    }

    // 9. Check 24h cooldown
    const lastClaim = user.lastSatsClaim ? (user.lastSatsClaim.toDate ? user.lastSatsClaim.toDate() : new Date(user.lastSatsClaim)) : null;
    if (lastClaim) {
        const cooldownEnd = lastClaim.getTime() + (FAUCET.COOLDOWN_HOURS * 60 * 60 * 1000);
        if (Date.now() < cooldownEnd) {
            const hoursLeft = Math.ceil((cooldownEnd - Date.now()) / 3600000);
            return { success: false, error: 'Cooldown active. Try again in ~' + hoursLeft + ' hour(s).' };
        }
    }

    // 10. Check daily per-user cap
    const today = new Date().toISOString().split('T')[0];
    const dailyDoc = await db.collection('users').doc(uid).collection('sats_daily').doc(today).get();
    const dailyUsed = dailyDoc.exists ? (dailyDoc.data().amount || 0) : 0;
    if (dailyUsed + amount > FAUCET.MAX_DAILY_PER_USER_SATS) {
        const remaining = FAUCET.MAX_DAILY_PER_USER_SATS - dailyUsed;
        return { success: false, error: 'Daily limit reached. You can claim ' + remaining + ' more sats today.' };
    }

    // 11. Check global daily cap
    const globalDoc = await db.collection('faucet_stats').doc(today).get();
    const globalUsed = globalDoc.exists ? (globalDoc.data().totalPaid || 0) : 0;
    if (globalUsed + amount > FAUCET.GLOBAL_DAILY_MAX_SATS) {
        return { success: false, error: 'Daily faucet limit reached. Try again tomorrow.' };
    }

    // 12. Check kill switch
    const configDoc = await db.collection('faucet_config').doc('settings').get();
    if (configDoc.exists && configDoc.data().paused) {
        return { success: false, error: 'Sats faucet is temporarily paused.' };
    }

    // 13. Check wallet balance floor
    let nwc;
    try {
        nwc = new NWCClient({ nostrWalletConnectUrl: FAUCET.NWC_URL });
        const balanceResult = await nwc.getBalance();
        const walletBalance = balanceResult.balance; // in msats
        const walletSats = Math.floor(walletBalance / 1000);
        if (walletSats < FAUCET.WALLET_BALANCE_FLOOR_SATS) {
            return { success: false, error: 'Faucet is being refilled. Try again later.' };
        }
    } catch (e) {
        console.error('[FAUCET] Balance check failed:', e.message);
        return { success: false, error: 'Could not connect to payment wallet. Try again later.' };
    }

    // 14. PAY THE INVOICE via NWC
    try {
        const payResult = await nwc.payInvoice({ invoice: invoice });
        if (!payResult || !payResult.preimage) {
            return { success: false, error: 'Payment failed. Check your invoice and try again.' };
        }

        // 15. Record the withdrawal in Firestore (atomic)
        const batch = db.batch();

        // Deduct points, update user
        const pointsToDeduct = amount * FAUCET.POINTS_PER_SAT;
        batch.update(db.collection('users').doc(uid), {
            points: admin.firestore.FieldValue.increment(-pointsToDeduct),
            satsWithdrawn: admin.firestore.FieldValue.increment(amount),
            lastSatsClaim: admin.firestore.FieldValue.serverTimestamp()
        });

        // Withdrawal history
        batch.set(db.collection('users').doc(uid).collection('sats_withdrawals').doc(), {
            amount: amount,
            pointsDeducted: pointsToDeduct,
            invoice: invoice.substring(0, 50) + '...',
            preimage: payResult.preimage,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // Daily per-user tracking
        batch.set(db.collection('users').doc(uid).collection('sats_daily').doc(today), {
            amount: admin.firestore.FieldValue.increment(amount)
        }, { merge: true });

        // Global daily tracking
        batch.set(db.collection('faucet_stats').doc(today), {
            totalPaid: admin.firestore.FieldValue.increment(amount),
            claimCount: admin.firestore.FieldValue.increment(1)
        }, { merge: true });

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
        return { success: false, error: 'Payment failed: ' + (e.message || 'Unknown error') };
    }
});

// ===== FAUCET ADMIN — getFaucetStats =====
exports.getFaucetStats = functions.https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.email !== 'needcreations@gmail.com') {
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

// ===== FAUCET ADMIN — toggleFaucet =====
exports.toggleFaucet = functions.https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.email !== 'needcreations@gmail.com') {
        throw new functions.https.HttpsError('permission-denied', 'Admin only');
    }
    const paused = !!data.paused;
    await db.collection('faucet_config').doc('settings').set({ paused: paused }, { merge: true });
    return { success: true, paused: paused };
});
