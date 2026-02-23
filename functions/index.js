const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');

admin.initializeApp();
const db = admin.firestore();

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
    const otpauth = authenticator.keyuri(email, 'Bitcoin Education Archive', secret);
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
    const isValid = authenticator.verify({ token: data.code, secret: secret });
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
    const isValid = authenticator.verify({ token: data.code, secret: secret });
    
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
    const isValid = authenticator.verify({ token: data.code, secret: doc.data().secret });
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
exports.streakReminder = functions.pubsub
    .schedule('0 20 * * *')   // 8:00 PM UTC daily
    .timeZone('UTC')
    .onRun(async (context) => {
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
// Clean up stale/invalid push tokens (weekly)
// =============================================
exports.cleanPushTokens = functions.pubsub
    .schedule('0 3 * * 0')   // 3 AM UTC every Sunday
    .timeZone('UTC')
    .onRun(async (context) => {
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
