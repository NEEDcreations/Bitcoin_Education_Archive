'use strict';

// Firestore wiring for referrals. Decisions live in referrals.js so tests
// can run without Firebase. Admin SDK writes bypass the security rules.

const functionsV1 = require('firebase-functions/v1');
const admin = require('firebase-admin');
const referrals = require('./referrals');
const referralTiers = require('../referral-tiers');
const rewardNotify = require('./rewardNotify');
const faucetGuard = require('./faucetGuard');
const ipHmac = require('./ipHmac');
const accountTombstone = require('./accountTombstone');

function db() {
    return admin.firestore();
}

function httpsError(code, message) {
    return new functionsV1.https.HttpsError(code, message);
}

function requireUser(context) {
    if (!context || !context.auth) throw httpsError('unauthenticated', 'Must be signed in');
    if (context.auth.token && context.auth.token.firebase && context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw httpsError('permission-denied', 'Anonymous users cannot use referrals');
    }
    return context.auth.uid;
}

function requestIp(context) {
    return faucetGuard.clientIpFromRequest(context && context.rawRequest).slice(0, 64);
}

function millisOf(value) {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value === 'number' && isFinite(value)) return value;
    if (typeof value === 'object' && typeof value._seconds === 'number') return value._seconds * 1000;
    return 0;
}

async function authProfile(uid) {
    try {
        const record = await admin.auth().getUser(uid);
        const raw = record && record.metadata && record.metadata.creationTime;
        const ms = Date.parse(raw || '');
        const providers = [];
        ((record && record.providerData) || []).forEach(function(row) {
            if (row && row.providerId) providers.push(String(row.providerId));
        });
        return {
            createdMs: isFinite(ms) ? ms : null,
            emailVerified: !!(record && record.emailVerified),
            providers: providers,
            email: (record && record.email) || '',
            providerRows: ((record && record.providerData) || []).map(function (row) {
                return { providerId: row && row.providerId, uid: row && row.uid };
            }),
        };
    } catch (e) {
        return { createdMs: null, emailVerified: false, providers: [], email: '', providerRows: [] };
    }
}

async function linkedAccount(uid, user, ip, nowMs) {
    const reasons = [];
    const fpId = faucetGuard.fingerprintDocId(user && user.fingerprint);
    if (fpId) {
        const fpDoc = await db().collection('faucet_fingerprints').doc(fpId).get();
        const uids = fpDoc.exists ? (fpDoc.data().uids || []) : [];
        const decision = faucetGuard.assessFingerprint(uids, uid);
        if (!decision.ok) reasons.push('linked-fingerprint');
    }
    const net = faucetGuard.networkKeys(ip);
    if (net) {
        const ipDoc = await db().collection('faucet_ip_log').doc(net.exactId).get();
        const subnetDoc = await db().collection('faucet_subnet_log').doc(net.rangeId).get();
        const ipSlot = ipDoc.exists ? ipDoc.data() : {};
        const subnetSlot = subnetDoc.exists ? subnetDoc.data() : {};
        const ipDecision = faucetGuard.assessExactIpSlot({
            seen: ipSlot.seen || null,
            lastUid: ipSlot.lastUid || '',
            lastClaimMs: millisOf(ipSlot.lastClaim),
        }, uid, nowMs);
        if (!ipDecision.ok) reasons.push('linked-ip');
        const subnetDecision = faucetGuard.assessSubnetSlot({
            seen: subnetSlot.seen || null,
            lastUid: subnetSlot.lastUid || '',
            lastClaimMs: millisOf(subnetSlot.lastClaim),
        }, uid, nowMs);
        if (!subnetDecision.ok) reasons.push('linked-subnet');
    }
    const ln = faucetGuard.normalizeLightningAddress(
        (user && (user.lightningAddress || user.lightning || user.lnAddress)) || ''
    );
    if (ln && faucetGuard.validLightningAddress(ln)) {
        const lockDoc = await db().collection('lightning_addresses').doc(ln).get();
        const lockOwner = lockDoc.exists ? String(lockDoc.data().uid || '') : '';
        let lockOwnerBanned = false;
        if (lockOwner && lockOwner !== uid) {
            const other = await db().collection('users').doc(lockOwner).get();
            const otherLedger = await db().collection('faucet_ledger').doc(lockOwner).get();
            lockOwnerBanned = (other.exists && other.data().satsDisabled === true)
                || (otherLedger.exists && otherLedger.data().banned === true)
                || (other.exists && other.data().banned === true);
        }
        const addr = faucetGuard.assessAddressLock({
            callerUid: uid,
            requested: ln,
            saved: ln,
            lockOwner: lockOwner,
            lockOwnerBanned: lockOwnerBanned,
        });
        if (!addr.ok) reasons.push('linked-lightning');
    }
    return reasons;
}

function userView(uid, data) {
    return Object.assign({ uid: uid }, data || {});
}

async function lookupReferrerUid(code, selfUid) {
    const normalized = referrals.normalizeCode(code);
    if (!normalized) return '';
    const codeDoc = await db().collection('referralCodes').doc(normalized).get();
    if (codeDoc.exists) {
        const owner = codeDoc.data().uid || '';
        if (owner && owner !== selfUid) return owner;
    }
    const byField = await db().collection('users').where('referralCode', '==', normalized).limit(2).get();
    if (byField.size === 1 && byField.docs[0].id !== selfUid) return byField.docs[0].id;
    if (byField.size > 1) return '';
    const prefix = await db().collection('users')
        .orderBy(admin.firestore.FieldPath.documentId())
        .startAt(normalized)
        .endAt(normalized + '\uf8ff')
        .limit(5)
        .get();
    const hits = prefix.docs.filter(function(doc) {
        return doc.id.indexOf(normalized) === 0 && doc.id !== selfUid;
    });
    if (hits.length === 1) return hits[0].id;
    return '';
}

async function chooseReferralCode(uid, data) {
    const stored = referrals.normalizeCode(data && data.referralCode);
    if (stored) return stored;
    const prefix = referrals.referralCodeForUid(uid);
    if (prefix) return prefix;
    if (!referrals.needsMintedReferralCode(uid)) return '';
    for (let salt = 0; salt < 8; salt++) {
        const candidate = referrals.mintedReferralCode(uid, salt);
        const taken = await db().collection('referralCodes').doc(candidate).get();
        const owner = taken.exists ? String((taken.data() || {}).uid || '') : '';
        if (!owner || owner === uid) return candidate;
    }
    return '';
}

async function ensureReferralCode(uid) {
    const userRef = db().collection('users').doc(uid);
    const pre = await userRef.get();
    if (!pre.exists) return '';
    const code = await chooseReferralCode(uid, pre.data() || {});
    if (!code) return '';
    const codeRef = db().collection('referralCodes').doc(code);
    await db().runTransaction(async function(t) {
        const [userDoc, codeDoc] = await Promise.all([t.get(userRef), t.get(codeRef)]);
        if (!userDoc.exists) return;
        const owner = codeDoc.exists ? String((codeDoc.data() || {}).uid || '') : '';
        if (owner && owner !== uid) return;
        if (userDoc.data().referralCode !== code) {
            t.update(userRef, { referralCode: code });
        }
        if (!owner) {
            t.set(codeRef, {
                uid: uid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
    });
    return code;
}

function arrivalFromDoc(snap) {
    if (!snap || !snap.exists) return null;
    const data = snap.data() || {};
    const ms = millisOf(data.arrivedAt);
    if (!ms) return null;
    return {
        ms: ms,
        anonymous: data.anonymous === true,
    };
}

async function readArrival(uid) {
    if (!uid) return null;
    const snap = await db().collection('referral_arrivals').doc(uid).get();
    return arrivalFromDoc(snap);
}

async function recordReferralArrival(uid, data) {
    const id = String(uid || '');
    if (!id) return;
    const ref = db().collection('referral_arrivals').doc(id);
    let anonymous = false;
    // A new Lightning login has no provider rows. That is a full account,
    // not a guest, so the 100-point signup cap still applies.
    if (!referrals.needsMintedReferralCode(id)) {
        try {
            const record = await admin.auth().getUser(id);
            const providers = ((record && record.providerData) || []).map(function (row) {
                return row && row.providerId ? String(row.providerId) : '';
            }).filter(Boolean);
            anonymous = providers.length === 0 || providers.every(function (provider) {
                return provider === 'anonymous';
            });
        } catch (e) {
            anonymous = false;
        }
    }
    const fromDoc = millisOf(data && data.created);
    await db().runTransaction(async function (t) {
        const existing = await t.get(ref);
        if (arrivalFromDoc(existing)) return;
        t.set(ref, {
            arrivedAt: fromDoc ? admin.firestore.Timestamp.fromMillis(fromDoc) : admin.firestore.FieldValue.serverTimestamp(),
            anonymous: anonymous === true,
        }, { merge: true });
    });
}

// The guest clock is server-written. Copy it onto the upgraded account when
// it is earlier, then tighten a not-yet-paid referral that no longer sits
// inside the new-account window. Never loosens a late or rejected doc.
async function adoptGuestArrival(guestUid, destUid) {
    const guestId = referrals.normalizeGuestUid(guestUid);
    const destId = String(destUid || '');
    if (!guestId || !destId || guestId === destId) return;
    const guest = await readArrival(guestId);
    if (!guest) return;
    const destRef = db().collection('referral_arrivals').doc(destId);
    await db().runTransaction(async function (t) {
        const snap = await t.get(destRef);
        const have = arrivalFromDoc(snap);
        if (have && have.ms <= guest.ms) return;
        t.set(destRef, {
            arrivedAt: admin.firestore.Timestamp.fromMillis(guest.ms),
            anonymous: guest.anonymous === true,
        }, { merge: true });
    });
    const referralRef = db().collection('referrals').doc(destId);
    const referralSnap = await referralRef.get();
    if (!referralSnap.exists) return;
    const status = String((referralSnap.data() || {}).status || '');
    if (status !== 'pending' && status !== 'flagged') return;
    const userSnap = await db().collection('users').doc(destId).get();
    const adopted = await readArrival(destId);
    const profile = await authProfile(destId);
    const start = referrals.referralWindowStart({
        authCreatedMs: profile.createdMs,
        serverArrivalMs: adopted && adopted.ms,
    });
    const fair = referrals.fairUpgradeWindow({
        nowMs: Date.now(),
        ownArrivalMs: adopted && adopted.ms,
        ownAnonymous: !!(adopted && adopted.anonymous),
    });
    const gate = referrals.registrationGate({
        nowMs: Date.now(),
        createdMs: start,
        points: userSnap.exists ? (userSnap.data() || {}).points : 0,
        fairWindow: fair,
    });
    if (gate.ok) return;
    if (gate.status !== 'late' && gate.status !== 'rejected') return;
    await referralRef.set({ status: gate.status }, { merge: true });
}

function referralPayload(referredUid, referrerUid, code, status, flags) {
    return {
        referredUserUid: referredUid,
        referredUid: referredUid,
        referredUser: referredUid,
        referrerUid: referrerUid || '',
        referrerCode: code,
        status: status,
        verified: false,
        ticketsAwarded: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
}

async function takeRegisterRate(uid, now) {
    const ref = db().collection('rate_limits').doc('referral_' + uid);
    let decision = { ok: false, reason: 'rate' };
    await db().runTransaction(async function(t) {
        const snap = await t.get(ref);
        const prev = snap.exists ? snap.data() : {};
        decision = referrals.registerRateDecision({
            lastMs: prev.lastCall,
            windowStart: prev.windowStart,
            count: prev.count || 0,
        }, now);
        if (!decision.ok) return;
        t.set(ref, {
            lastCall: decision.lastMs,
            windowStart: decision.windowStart,
            count: decision.count,
        });
    });
    return decision;
}

function hmacIps(list) {
    const raw = Array.isArray(list) ? list : String(list || '').split(/[,\s]+/);
    const out = [];
    raw.forEach(function(ip) {
        const mac = ipHmac.hmacIp(ip);
        if (mac) out.push(mac);
    });
    return out;
}

async function emailHistoryHashes(uid) {
    try {
        const snap = await db().collection('email_history').doc(uid).get();
        const hashes = snap && snap.exists && Array.isArray(snap.data().hashes) ? snap.data().hashes : [];
        return hashes.map(function (hash) { return String(hash || ''); }).filter(Boolean);
    } catch (e) {
        return [];
    }
}

async function registerReferral(data, context) {
    const uid = requireUser(context);
    const code = referrals.normalizeCode(data && data.refCode);
    if (!code) throw httpsError('invalid-argument', 'Referral code is missing');
    if (referrals.isSelfReferral(uid, code)) return { success: false, reason: 'self' };
    // Client clocks are ignored. guestUid only names a doc the server wrote.

    const existingRef = await db().collection('referrals').doc(uid).get();
    if (existingRef.exists) return { success: false, reason: 'exists' };

    const now = Date.now();
    const rate = await takeRegisterRate(uid, now);
    if (!rate.ok) throw httpsError('resource-exhausted', 'Too many referral attempts. Wait a moment and try again.');

    const profile = await authProfile(uid);
    const referredSnap = await db().collection('users').doc(uid).get();
    if (!referredSnap.exists) throw httpsError('not-found', 'User not found');
    const referred = userView(uid, referredSnap.data());
    const tomb = await accountTombstone.lookupByMaterials(db(), accountTombstone.identityFrom({
        uid: uid,
        authUser: {
            uid: uid,
            email: profile.email || '',
            emailVerified: profile.emailVerified === true,
            providerData: profile.providerRows || [],
        },
        token: (context.auth && context.auth.token) || {},
    }));
    if (tomb.configured && (tomb.summary.banned || tomb.summary.satsDisabled || tomb.summary.ledgerBanned)) {
        const patch = await accountTombstone.applyIdentityFlags(db(), uid, tomb.summary);
        Object.assign(referred, patch.user);
        if (patch.ledger.banned) referred.ledgerBanned = true;
    }
    const authCreatedMs = accountTombstone.pulledCreatedMs(profile.createdMs, tomb.summary, now);
    const ownArrival = await readArrival(uid);
    const guestUid = referrals.normalizeGuestUid(data && data.guestUid);
    let guestArrival = null;
    let guestMergedHere = false;
    if (guestUid && guestUid !== uid) {
        guestArrival = await readArrival(guestUid);
        if (guestArrival) {
            const guestUser = await db().collection('users').doc(guestUid).get();
            guestMergedHere = guestUser.exists && String((guestUser.data() || {}).mergedInto || '') === uid;
        }
    }
    // A named guest clock counts once the server has merged that guest here,
    // or while that guest is still inside the window. A stale id left in the
    // browser does not pull a different account backward.
    let guestClockMs = null;
    if (guestArrival && guestMergedHere) guestClockMs = guestArrival.ms;
    else if (guestArrival && guestArrival.anonymous === true) {
        const age = now - guestArrival.ms;
        if (age <= referrals.SIGNUP_WINDOW_MS && age >= -5 * 60 * 1000) guestClockMs = guestArrival.ms;
    }
    const createdMs = referrals.referralWindowStart({
        authCreatedMs: authCreatedMs,
        serverArrivalMs: ownArrival && ownArrival.ms,
        guestArrivalMs: guestClockMs,
    });
    const fairWindow = referrals.fairUpgradeWindow({
        nowMs: now,
        uid: uid,
        ownArrivalMs: ownArrival && ownArrival.ms,
        ownAnonymous: !!(ownArrival && ownArrival.anonymous),
        guestArrivalMs: guestMergedHere ? guestArrival.ms : null,
        guestAnonymous: guestMergedHere ? guestArrival.anonymous === true : false,
        guestMergedHere: guestMergedHere,
    });
    const rawIp = requestIp(context);
    const linked = await linkedAccount(uid, referred, rawIp, now);
    const gate = referrals.registrationGate({
        nowMs: now,
        createdMs: createdMs,
        points: referred.points,
        self: false,
        linked: linked.length > 0,
        fairWindow: fairWindow,
    });
    if (!gate.record) {
        if (gate.reason === 'age-unknown') {
            throw httpsError('failed-precondition', 'Could not verify account age');
        }
        return { success: false, reason: gate.reason, status: gate.status };
    }

    if (referrals.normalizeCode(referred.referralCode) === code) return { success: false, reason: 'self' };
    await ensureReferralCode(uid);
    const referrerUid = await lookupReferrerUid(code, uid);
    let referrer = null;
    if (referrerUid) {
        const referrerSnap = await db().collection('users').doc(referrerUid).get();
        if (referrerSnap.exists) referrer = userView(referrerUid, referrerSnap.data());
    }
    let signupIpHmac = '';
    try {
        signupIpHmac = ipHmac.hmacIp(rawIp);
    } catch (e) {
        throw httpsError('failed-precondition', 'Referral signup cannot be recorded right now');
    }
    if (profile.emailVerified === true && profile.email && !referred.emailHash) {
        referred.emailHash = accountTombstone.emailHmac(profile.email);
    }
    referred.emailHistoryHashes = await emailHistoryHashes(uid);
    if (referrer) {
        referrer.emailHistoryHashes = await emailHistoryHashes(referrer.uid);
    }
    const flags = referrer ? referrals.fraudFlags(referred, referrer, rawIp) : [];
    const refereeAlreadyPaid = !!(tomb.summary && (tomb.summary.refereePaid || tomb.summary.referralRedeemed));
    if (refereeAlreadyPaid) referred.priorReferral = true;
    if (refereeAlreadyPaid && flags.indexOf('prior-referral') === -1) {
        flags.push('prior-referral');
    }
    linked.forEach(function(reason) {
        if (flags.indexOf('linked-account') === -1) flags.push('linked-account');
        if (flags.indexOf(reason) === -1) flags.push(reason);
    });
    let status = gate.ok && referrer ? referrals.statusForFlags(flags) : gate.status;
    if (!gate.ok) status = gate.status;
    else if (!referrer) status = 'pending';

    const refRef = db().collection('referrals').doc(uid);
    const userRef = db().collection('users').doc(uid);
    const signalRef = db().collection('referral_signals').doc(uid);
    const referrerRef = referrer ? db().collection('users').doc(referrer.uid) : null;
    let created = false;
    await db().runTransaction(async function(t) {
        const existing = await t.get(refRef);
        if (existing.exists) return;
        const fresh = await t.get(userRef);
        if (!fresh.exists) return;
        if (fresh.data().referredBy && fresh.data().referredBy !== code) return;
        t.set(refRef, referralPayload(uid, referrer ? referrer.uid : '', code, status));
        t.set(signalRef, {
            signupIpHmac: signupIpHmac,
            expireAt: admin.firestore.Timestamp.fromMillis(now + referrals.SIGNAL_TTL_MS),
            referrerUid: referrer ? referrer.uid : '',
            flags: flags,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        if (referrals.writesReferredBy(status)) {
            t.update(userRef, { referredBy: code, referralVerified: false });
        }
        if (referrerRef && referrals.writesReferredBy(status)) {
            t.update(referrerRef, {
                referralInvited: admin.firestore.FieldValue.increment(1),
            });
        }
        created = true;
    });

    let paid = false;
    if (created && status === 'pending' && (Number(referred.points) || 0) >= referrals.MAXI_POINTS) {
        const result = await payIfQualified(uid);
        paid = !!(result && result.paid);
    }
    return {
        success: status === 'pending' || status === 'flagged',
        reason: created ? status : 'exists',
        status: status,
        paid: paid,
    };
}

async function payIfQualified(referredUid) {
    const uid = String(referredUid || '');
    if (!uid) return { paid: false, reason: 'missing-user' };
    const refRef = db().collection('referrals').doc(uid);
    const referredRef = db().collection('users').doc(uid);
    const signalRef = db().collection('referral_signals').doc(uid);
    const pre = await refRef.get();
    if (!pre.exists) return { paid: false, reason: 'no-referral' };
    try {
        ipHmac.hmacIp('');
    } catch (e) {
        throw httpsError('failed-precondition', 'Referral payout cannot be checked right now');
    }

    const current = pre;
    const referrerUid = current.data().referrerUid || await lookupReferrerUid(current.data().referrerCode, uid);
    if (!referrerUid) return { paid: false, reason: 'missing-user' };
    const profile = await authProfile(uid);
    const tomb = await accountTombstone.lookupByMaterials(db(), accountTombstone.identityFrom({
        uid: uid,
        authUser: {
            uid: uid,
            email: profile.email || '',
            emailVerified: profile.emailVerified === true,
            providerData: profile.providerRows || [],
        },
    }));
    const createdMs = accountTombstone.pulledCreatedMs(profile.createdMs, tomb.summary, Date.now());
    const referrerRef = db().collection('users').doc(referrerUid);
    const referredLedgerRef = db().collection('faucet_ledger').doc(uid);
    const referrerLedgerRef = db().collection('faucet_ledger').doc(referrerUid);
    const limitRef = db().collection('referral_pay_limits').doc(referrerUid);
    const referredHistRef = db().collection('email_history').doc(uid);
    const referrerHistRef = db().collection('email_history').doc(referrerUid);

    let outcome = { paid: false, reason: 'skip' };
    await db().runTransaction(async function(t) {
        const [referralDoc, referredDoc, referrerDoc, signalDoc, referredLedger, referrerLedger, limitDoc, referredHist, referrerHist] = await Promise.all([
            t.get(refRef),
            t.get(referredRef),
            t.get(referrerRef),
            t.get(signalRef),
            t.get(referredLedgerRef),
            t.get(referrerLedgerRef),
            t.get(limitRef),
            t.get(referredHistRef),
            t.get(referrerHistRef),
        ]);
        if (!referralDoc.exists || !referredDoc.exists || !referrerDoc.exists) {
            outcome = { paid: false, reason: 'missing-user' };
            return;
        }
        if (!signalDoc.exists) {
            t.update(refRef, {
                status: 'legacy',
                rejectionFlags: admin.firestore.FieldValue.delete(),
            });
            outcome = { paid: false, reason: 'legacy' };
            return;
        }
        const referredView = userView(uid, referredDoc.data());
        const referrerView = userView(referrerUid, referrerDoc.data());
        referredView.ledgerBanned = referredLedger.exists && referredLedger.data().banned === true;
        referrerView.ledgerBanned = referrerLedger.exists && referrerLedger.data().banned === true;
        if (tomb.summary && tomb.summary.ledgerBanned) referredView.ledgerBanned = true;
        Object.assign(referredView, accountTombstone.applyFlagsPatch(tomb.summary).user);
        referredView.priorReferral = !!(tomb.summary && (tomb.summary.refereePaid || tomb.summary.referralRedeemed));
        referredView.createdMs = createdMs;
        referredView.emailVerified = profile.emailVerified;
        referredView.providers = profile.providers;
        if (profile.emailVerified === true && profile.email && !referredView.emailHash) {
            referredView.emailHash = accountTombstone.emailHmac(profile.email);
        }
        referredView.emailHistoryHashes = referredHist.exists && Array.isArray(referredHist.data().hashes) ? referredHist.data().hashes : [];
        referrerView.emailHistoryHashes = referrerHist.exists && Array.isArray(referrerHist.data().hashes) ? referrerHist.data().hashes : [];
        const signal = signalDoc.data() || {};
        const exp = millisOf(signal.expireAt);
        const fresh = !exp || exp > Date.now();
        const storedHmac = fresh ? String(signal.signupIpHmac || '') : '';
        referredView.known_ips = fresh ? hmacIps(referredView.known_ips) : [];
        referrerView.known_ips = fresh ? hmacIps(referrerView.known_ips) : [];
        const recentPaidAt = limitDoc.exists ? (limitDoc.data().paidAtMs || []) : [];
        const decision = referrals.assessReferralPayout({
            hasSignal: true,
            nowMs: Date.now(),
            recentPaidAt: recentPaidAt,
            referral: referralDoc.data(),
            referred: referredView,
            referrer: referrerView,
            signupIpHmac: storedHmac,
        });
        const clearFlags = { rejectionFlags: admin.firestore.FieldValue.delete() };
        if (decision.action === 'legacy') {
            t.update(refRef, Object.assign({ status: 'legacy' }, clearFlags));
            outcome = { paid: false, reason: 'legacy' };
            return;
        }
        if (decision.action === 'skip') {
            if (referralDoc.data().rejectionFlags) t.update(refRef, clearFlags);
            outcome = { paid: false, reason: decision.reason };
            return;
        }
        if (decision.action === 'flag' || decision.action === 'reject') {
            t.update(refRef, Object.assign({
                status: decision.action === 'reject' ? 'rejected' : 'flagged',
                ticketsAwarded: false,
                verified: false,
            }, clearFlags));
            t.set(signalRef, { flags: decision.flags || [] }, { merge: true });
            outcome = { paid: false, reason: decision.reason };
            return;
        }
        const tickets = referrals.REFERRAL_TICKETS;
        const nowMs = Date.now();
        const kept = (Array.isArray(recentPaidAt) ? recentPaidAt : []).filter(function(ms) {
            const n = Number(ms) || 0;
            return n > 0 && nowMs - n < referrals.REFERRAL_PAY_WINDOW_MS;
        });
        kept.push(nowMs);
        t.update(refRef, Object.assign({
            status: 'paid',
            verified: true,
            ticketsAwarded: true,
            referrerUid: referrerUid,
            referredUserUid: uid,
            referredUid: uid,
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
            verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
            ticketsEach: tickets,
        }, clearFlags));
        t.set(limitRef, {
            paidAtMs: kept.slice(-40),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        t.update(referrerRef, {
            orangeTickets: admin.firestore.FieldValue.increment(tickets),
            referralTicketsEarned: admin.firestore.FieldValue.increment(tickets),
            referralCount: admin.firestore.FieldValue.increment(1),
        });
        t.update(referredRef, {
            orangeTickets: admin.firestore.FieldValue.increment(tickets),
            referralVerified: true,
        });
        const stamp = admin.firestore.FieldValue.serverTimestamp();
        rewardNotify.apply(t, db(), stamp, rewardNotify.plan({
            uid: referrerUid,
            tickets: tickets,
            sourceLabel: 'a referral reaching Maxi',
            icon: '🎟️',
            onceKey: 'referral_out_' + uid,
        }));
        rewardNotify.apply(t, db(), stamp, rewardNotify.plan({
            uid: uid,
            tickets: tickets,
            sourceLabel: 'reaching Maxi with a referral',
            icon: '🎟️',
            onceKey: 'referral_in_' + referrerUid,
        }));
        outcome = { paid: true, reason: 'paid', ticketsEach: tickets, referrerUid: referrerUid };
    });
    if (outcome.paid && outcome.referrerUid && outcome.referrerUid !== uid) {
        try {
            const { samePerson } = require('./badgeProgress');
            const referrerSnap = await db().collection('users').doc(outcome.referrerUid).get();
            const referredSnap = await db().collection('users').doc(uid).get();
            const left = Object.assign({}, referrerSnap.exists ? (referrerSnap.data() || {}) : {}, { uid: outcome.referrerUid });
            const right = Object.assign({}, referredSnap.exists ? (referredSnap.data() || {}) : {}, { uid: uid });
            if (!samePerson(left, right)) {
                await require('./raidBossEngine').noteTrusted(db(), admin, {
                    metric: 'referralsPaid',
                    uid: outcome.referrerUid,
                    dedupeKey: 'ref-' + uid,
                    amount: 1,
                    now: new Date(),
                });
            }
        } catch (e) {
            console.warn('[referral] raid', e && e.message ? e.message : e);
        }
    }
    return outcome;
}

async function grantReferralBadges(uid) {
    try {
        const { grantFamily, familyFor } = require('./grantBadge');
        await grantFamily(db(), admin, uid, familyFor('referralMaxiCount'));
    } catch (e) {
        console.warn('[referral] badges', e && e.message ? e.message : e);
    }
}

async function readAll(refs) {
    if (!refs.length) return [];
    const firestore = db();
    if (typeof firestore.getAll === 'function') return firestore.getAll.apply(firestore, refs);
    const out = [];
    for (let i = 0; i < refs.length; i++) out.push(await refs[i].get());
    return out;
}

// Full recount. Credited referrals are the paid/verified/tickets stamp from
// payIfQualified. The live count drops a referee who no longer holds Maxi or
// who is banned, sats-disabled, ledger-banned, or deleted.
async function countReferralMaxiFor(referrerUid) {
    const uid = String(referrerUid || '');
    if (!uid) return 0;
    const snap = await db().collection('referrals').where('referrerUid', '==', uid).get();
    const credited = [];
    snap.forEach(function (doc) {
        const data = Object.assign({ id: doc.id }, doc.data() || {});
        if (!referralTiers.creditedReferral(data)) return;
        const referredUid = referralTiers.referredUidOf(data);
        if (!referredUid || referredUid === uid) return;
        credited.push({ referral: data, referredUid: referredUid });
    });
    const rows = [];
    const chunk = 30;
    for (let i = 0; i < credited.length; i += chunk) {
        const slice = credited.slice(i, i + chunk);
        const userSnaps = await readAll(slice.map(function (row) {
            return db().collection('users').doc(row.referredUid);
        }));
        const ledgerSnaps = await readAll(slice.map(function (row) {
            return db().collection('faucet_ledger').doc(row.referredUid);
        }));
        for (let j = 0; j < slice.length; j++) {
            const userSnap = userSnaps[j];
            const ledgerSnap = ledgerSnaps[j];
            rows.push({
                referral: slice[j].referral,
                referee: userSnap && userSnap.exists ? userSnap.data() : null,
                ledger: ledgerSnap && ledgerSnap.exists ? ledgerSnap.data() : null,
            });
        }
    }
    return referralTiers.countCreditedMaxi(rows);
}

async function persistReferralMaxiCount(referrerUid) {
    const uid = String(referrerUid || '');
    if (!uid) return;
    const userRef = db().collection('users').doc(uid);
    const seen = await userRef.get();
    if (!seen.exists) return;
    const seenReferralCount = Number(seen.data().referralCount) || 0;
    const count = await countReferralMaxiFor(uid);
    let raced = false;
    await db().runTransaction(async function (t) {
        const snap = await t.get(userRef);
        if (!snap.exists) return;
        const data = snap.data() || {};
        // A payout landed while this recount was reading. That payout's trigger
        // recounts. Do not overwrite it with this snapshot.
        if ((Number(data.referralCount) || 0) !== seenReferralCount) {
            raced = true;
            return;
        }
        if (data.referralMaxiCount === count) return;
        if ((data.referralMaxiCount === undefined || data.referralMaxiCount === null) && count === 0) return;
        t.update(userRef, { referralMaxiCount: count });
    });
    if (raced) return;
    return count;
}

// Called from onUserWritten, which is exports.onUserReferral on users/{uid}.
// Reaching Maxi, a ban, sats-disabled, and account deletion are user-doc
// writes. There is no referrals-collection trigger for this count.
async function syncReferralMaxiCount(uid, before, after) {
    const deleted = !after;
    const prev = before || {};
    if (!deleted && (Number(prev.referralCount) || 0) !== (Number(after.referralCount) || 0)) {
        const counted = await persistReferralMaxiCount(uid);
        if (typeof counted === 'number') await grantReferralBadges(uid);
    }
    if (referralTiers.recountReasons(prev, deleted ? null : after).length) {
        const referral = await db().collection('referrals').doc(uid).get();
        if (!referral.exists) return;
        const referrerUid = String((referral.data() || {}).referrerUid || '');
        if (referrerUid && referrerUid !== uid) {
            const counted = await persistReferralMaxiCount(referrerUid);
            if (typeof counted === 'number') await grantReferralBadges(referrerUid);
        }
    }
}

async function onUserWritten(event) {
    const afterSnap = event.data && event.data.after;
    const beforeSnap = event.data && event.data.before;
    const uid = event.params.uid;
    if (!afterSnap || !afterSnap.exists) {
        try {
            await syncReferralMaxiCount(uid, beforeSnap && beforeSnap.exists ? (beforeSnap.data() || {}) : {}, null);
        } catch (err) {
            console.warn('[onUserReferral] maxi count', err && err.message ? err.message : err);
        }
        return null;
    }
    const created = !beforeSnap || beforeSnap.exists !== true;
    if (created) {
        try {
            const authUser = await admin.auth().getUser(uid);
            const tomb = await accountTombstone.lookupByMaterials(db(), accountTombstone.identityFrom({
                uid: uid,
                authUser: authUser,
            }));
            if (tomb.summary && (tomb.summary.banned || tomb.summary.satsDisabled || tomb.summary.ledgerBanned)) {
                await accountTombstone.applyIdentityFlags(db(), uid, tomb.summary);
            }
        } catch (err) {
            console.warn('[onUserReferral] identity', err && err.message ? err.message : err);
        }
    }
    const before = beforeSnap && beforeSnap.exists ? (beforeSnap.data() || {}) : {};
    const after = afterSnap.data() || {};
    if (created) {
        try {
            await recordReferralArrival(uid, after);
        } catch (err) {
            console.warn('[onUserReferral] arrival', err && err.message ? err.message : err);
        }
    }
    try {
        if (!referrals.normalizeCode(after.referralCode)) await ensureReferralCode(uid);
        const beforeActivity = referrals.activityPoints(before);
        const afterActivity = referrals.activityPoints(after);
        const crossed = referrals.crossedMaxi(beforeActivity, afterActivity);
        const referredByNew = !!after.referredBy && after.referredBy !== before.referredBy;
        const atMaxi = afterActivity >= referrals.MAXI_POINTS;
        if (crossed || (referredByNew && atMaxi)) await payIfQualified(uid);
    } catch (e) {
        console.error('[onUserReferral]', e && e.message ? e.message : e);
    }
    try {
        await syncReferralMaxiCount(uid, before, after);
    } catch (err) {
        console.warn('[onUserReferral] maxi count', err && err.message ? err.message : err);
    }
    return null;
}

async function scanPending(limit) {
    const cap = Math.max(1, Math.min(40, Number(limit) || 40));
    const stateRef = db().collection('referral_scan').doc('pending');
    const state = await stateRef.get();
    const cursor = state.exists ? String(state.data().cursor || '') : '';
    let query = db().collection('referrals')
        .where('status', '==', 'pending')
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(cap);
    if (cursor) query = query.startAfter(cursor);
    let snap = await query.get();
    if (snap.empty && cursor) {
        snap = await db().collection('referrals')
            .where('status', '==', 'pending')
            .orderBy(admin.firestore.FieldPath.documentId())
            .limit(cap)
            .get();
    }
    let paid = 0;
    for (let i = 0; i < snap.docs.length; i++) {
        try {
            const result = await payIfQualified(snap.docs[i].id);
            if (result && result.paid) paid++;
        } catch (e) {
            console.error('[payQualifiedReferrals]', e && e.message ? e.message : e);
        }
    }
    const next = snap.empty ? '' : snap.docs[snap.docs.length - 1].id;
    await stateRef.set({
        cursor: next,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { scanned: snap.size, paid: paid, cursor: next };
}

async function deleteMyReferralSignal(data, context) {
    const uid = requireUser(context);
    await db().collection('referral_signals').doc(uid).delete();
    return { success: true };
}

module.exports = {
    registerReferral: registerReferral,
    payIfQualified: payIfQualified,
    onUserWritten: onUserWritten,
    scanPending: scanPending,
    ensureReferralCode: ensureReferralCode,
    recordReferralArrival: recordReferralArrival,
    adoptGuestArrival: adoptGuestArrival,
    lookupReferrerUid: lookupReferrerUid,
    deleteMyReferralSignal: deleteMyReferralSignal,
    countReferralMaxiFor: countReferralMaxiFor,
    persistReferralMaxiCount: persistReferralMaxiCount,
};
