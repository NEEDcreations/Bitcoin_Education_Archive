'use strict';

// Firestore wiring for referrals. Decisions live in referrals.js so tests
// can run without Firebase. Admin SDK writes bypass the security rules.

const functionsV1 = require('firebase-functions/v1');
const admin = require('firebase-admin');
const referrals = require('./referrals');
const rewardNotify = require('./rewardNotify');
const faucetGuard = require('./faucetGuard');
const ipHmac = require('./ipHmac');
const ipReputation = require('./ipReputation');
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
    const netIds = ipReputation.networkDocIds(ip);
    if (ip && !netIds) {
        reasons.push('linked-ip-unverified');
    } else if (netIds) {
        const legacy = ipReputation.legacyNetworkIds(ip);
        let ipDoc = await db().collection('faucet_ip_log').doc(netIds.ipId).get();
        let subnetDoc = await db().collection('faucet_subnet_log').doc(netIds.rangeId).get();
        if (!ipDoc.exists && legacy && legacy.ipId !== netIds.ipId) {
            ipDoc = await db().collection('faucet_ip_log').doc(legacy.ipId).get();
        }
        if (!subnetDoc.exists && legacy && legacy.rangeId !== netIds.rangeId) {
            subnetDoc = await db().collection('faucet_subnet_log').doc(legacy.rangeId).get();
        }
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

async function ensureReferralCode(uid) {
    const code = referrals.referralCodeForUid(uid);
    if (!code) return '';
    const userRef = db().collection('users').doc(uid);
    const codeRef = db().collection('referralCodes').doc(code);
    await db().runTransaction(async function(t) {
        const [userDoc, codeDoc] = await Promise.all([t.get(userRef), t.get(codeRef)]);
        if (!userDoc.exists) return;
        if (userDoc.data().referralCode !== code) {
            t.update(userRef, { referralCode: code });
        }
        const owner = codeDoc.exists ? (codeDoc.data().uid || '') : '';
        if (!owner) {
            t.set(codeRef, {
                uid: uid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
    });
    return code;
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
    const createdMs = accountTombstone.pulledCreatedMs(profile.createdMs, tomb.summary, now);
    const rawIp = requestIp(context);
    const linked = await linkedAccount(uid, referred, rawIp, now);
    const gate = referrals.registrationGate({
        nowMs: now,
        createdMs: createdMs,
        points: referred.points,
        self: false,
        linked: linked.length > 0,
    });
    if (!gate.record) {
        if (gate.reason === 'age-unknown') {
            throw httpsError('failed-precondition', 'Could not verify account age');
        }
        return { success: false, reason: gate.reason, status: gate.status };
    }
    const rewardHeaders = context && context.rawRequest && context.rawRequest.headers ? context.rawRequest.headers : {};
    let reward = { action: 'fallback', reason: 'lookup', message: '', ipVerdict: null, deviceHmac: '', deviceAction: 'fallback' };
    try {
        reward = await ipReputation.assessReward({
            db: db(),
            ip: rawIp,
            uid: uid,
            userAgent: rewardHeaders['user-agent'] || '',
            language: rewardHeaders['accept-language'] || '',
            requestId: data && data.ipqsRequestId,
            purpose: 'referral',
        });
    } catch (e) {
        console.error('[referral] reward gate fallback');
    }

    await ensureReferralCode(uid);
    const referrerUid = await lookupReferrerUid(code, uid);
    let referrer = null;
    if (referrerUid) {
        const referrerSnap = await db().collection('users').doc(referrerUid).get();
        if (referrerSnap.exists) referrer = userView(referrerUid, referrerSnap.data());
    }
    if (referrer && ipReputation.deviceEnabled()) {
        const referrerDevice = await db().collection('user_devices').doc(referrer.uid).get();
        referrer.deviceHmac = referrerDevice.exists ? String((referrerDevice.data() || {}).deviceHmac || '') : '';
    }
    referred.deviceHmac = reward.deviceHmac || '';
    referred.ipqsAction = reward.ipVerdict ? reward.ipVerdict.action : '';
    referred.ipqsReason = reward.ipVerdict ? String(reward.ipVerdict.reason || '') : '';
    referred.deviceAction = reward.deviceAction === 'deny' || reward.deviceAction === 'hold' ? reward.deviceAction : '';
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
    const connection = referrals.signupConnection(flags, reward.ipVerdict, now);
    let status = gate.ok && referrer ? connection.status : gate.status;
    if (!gate.ok) status = gate.status;
    else if (!referrer) status = 'pending';
    const ipqsHold = status === 'held_connection' ? connection.ipqsHold : null;

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
        const verdict = reward.ipVerdict || {};
        const signalBody = {
            signupIpHmac: signupIpHmac,
            expireAt: admin.firestore.Timestamp.fromMillis(now + referrals.SIGNAL_TTL_MS),
            referrerUid: referrer ? referrer.uid : '',
            flags: flags,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            ipqsAction: verdict.action || 'fallback',
            ipqsReason: String(verdict.reason || reward.reason || '').slice(0, 40),
            ipqsFraudScore: verdict.fraudScore == null ? null : verdict.fraudScore,
            ipqsProxy: !!verdict.proxy,
            ipqsVpn: !!verdict.vpn,
            ipqsTor: !!verdict.tor,
            ipqsDatacenter: !!verdict.datacenter,
            ipqsRecentAbuse: !!verdict.recentAbuse,
            ipqsCountry: String(verdict.countryCode || '').slice(0, 2),
            ipqsCheckedAtMs: Number(verdict.checkedAtMs) || 0,
            deviceHmac: reward.deviceHmac || '',
        };
        if (ipqsHold) signalBody.ipqsHold = ipqsHold;
        t.set(signalRef, signalBody);
        const userUpdate = { referredBy: code, referralVerified: false };
        t.update(userRef, userUpdate);
        if (referrerRef && (status === 'pending' || status === 'flagged' || status === 'held_connection')) {
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
    let message = '';
    if (status === 'held_connection') message = reward.message || '';
    else if (reward.action === 'deny') message = reward.message || '';
    return {
        success: status === 'pending' || status === 'flagged' || status === 'held_connection',
        reason: created ? status : 'exists',
        status: status,
        paid: paid,
        message: message,
    };
}

function rawIpFromUser(user) {
    if (!user) return '';
    const raw = Array.isArray(user.known_ips) ? user.known_ips : String(user.known_ips || '').split(/[,\s]+/);
    for (let i = raw.length - 1; i >= 0; i--) {
        const ip = String(raw[i] || '').trim();
        if (!ip || /^[0-9a-f]{64}$/.test(ip)) continue;
        if (faucetGuard.networkKeys(ip)) return ip;
    }
    return '';
}

function liveIpVerdict(gate) {
    const verdict = gate && gate.ipVerdict;
    if (!verdict || typeof verdict !== 'object') return null;
    const action = String(verdict.action || '');
    if (action !== 'allow' && action !== 'hold' && action !== 'deny') return null;
    return verdict;
}

// Cheap qualification only. A stored IPQS flag is ignored so a real recheck can
// still run, but points, age, email, bans, and the other fraud flags go first.
async function aboutToPayReferral(uid, referrerUid, profile, tomb) {
    const devicesOn = ipReputation.deviceEnabled();
    const reads = [
        db().collection('referrals').doc(uid).get(),
        db().collection('users').doc(uid).get(),
        db().collection('users').doc(referrerUid).get(),
        db().collection('referral_signals').doc(uid).get(),
        db().collection('faucet_ledger').doc(uid).get(),
        db().collection('faucet_ledger').doc(referrerUid).get(),
        db().collection('referral_pay_limits').doc(referrerUid).get(),
        db().collection('email_history').doc(uid).get(),
        db().collection('email_history').doc(referrerUid).get(),
    ];
    if (devicesOn) {
        reads.push(db().collection('device_holds').doc(uid).get());
        reads.push(db().collection('user_devices').doc(uid).get());
        reads.push(db().collection('user_devices').doc(referrerUid).get());
    }
    const got = await Promise.all(reads);
    const referralDoc = got[0];
    const referredDoc = got[1];
    const referrerDoc = got[2];
    const signalDoc = got[3];
    const referredLedger = got[4];
    const referrerLedger = got[5];
    const limitDoc = got[6];
    const referredHist = got[7];
    const referrerHist = got[8];
    const referredHold = devicesOn ? got[9] : { exists: false };
    const referredDevice = devicesOn ? got[10] : { exists: false };
    const referrerDevice = devicesOn ? got[11] : { exists: false };
    if (!referralDoc.exists || !referredDoc.exists || !referrerDoc.exists || !signalDoc.exists) return false;
    const referredView = userView(uid, referredDoc.data());
    const referrerView = userView(referrerUid, referrerDoc.data());
    referredView.ledgerBanned = referredLedger.exists && referredLedger.data().banned === true;
    referrerView.ledgerBanned = referrerLedger.exists && referrerLedger.data().banned === true;
    if (tomb && tomb.summary && tomb.summary.ledgerBanned) referredView.ledgerBanned = true;
    Object.assign(referredView, accountTombstone.applyFlagsPatch(tomb && tomb.summary).user);
    referredView.priorReferral = !!(tomb && tomb.summary && (tomb.summary.refereePaid || tomb.summary.referralRedeemed));
    referredView.createdMs = accountTombstone.pulledCreatedMs(profile.createdMs, tomb && tomb.summary, Date.now());
    referredView.emailVerified = profile.emailVerified;
    referredView.providers = profile.providers;
    if (profile.emailVerified === true && profile.email && !referredView.emailHash) {
        referredView.emailHash = accountTombstone.emailHmac(profile.email);
    }
    referredView.emailHistoryHashes = referredHist.exists && Array.isArray(referredHist.data().hashes) ? referredHist.data().hashes : [];
    referrerView.emailHistoryHashes = referrerHist.exists && Array.isArray(referrerHist.data().hashes) ? referrerHist.data().hashes : [];
    referredView.ipqsAction = '';
    const signal = signalDoc.data() || {};
    if (devicesOn) {
        referredView.deviceHmac = String(signal.deviceHmac || '');
        if (!referredView.deviceHmac && referredDevice.exists) {
            referredView.deviceHmac = String((referredDevice.data() || {}).deviceHmac || '');
        }
        if (referrerDevice.exists) {
            referrerView.deviceHmac = String((referrerDevice.data() || {}).deviceHmac || '');
        }
        const hold = referredHold.exists ? (referredHold.data() || {}) : null;
        const holdExp = hold ? millisOf(hold.expireAt) : 0;
        if (hold && hold.approved !== true && hold.held === true && (!holdExp || holdExp > Date.now())) {
            referredView.deviceAction = hold.reason === 'device-fraud' ? 'deny' : 'hold';
        }
    }
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
        signal: signal,
        referred: referredView,
        referrer: referrerView,
        signupIpHmac: storedHmac,
    });
    return decision.action === 'pay';
}

function observedVerdict(opts) {
    if (!opts || opts.applyObservation !== true) return null;
    const verdict = opts.serverVerdict;
    if (!verdict || typeof verdict !== 'object') return null;
    const action = String(verdict.action || '');
    if (action !== 'allow' && action !== 'hold' && action !== 'deny') return null;
    return verdict;
}

async function payIfQualified(referredUid, opts) {
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
    const extra = opts || {};
    let checkIp = '';
    if (!extra.requestIp && extra.applyObservation !== true) {
        const remembered = await referredRef.get();
        checkIp = rawIpFromUser(remembered.exists ? remembered.data() : null);
    }
    const signalPre = await signalRef.get();
    const signalPreData = signalPre.exists ? (signalPre.data() || {}) : {};
    const holdPre = referrals.connectionHoldState(current.data(), signalPreData);
    const legacyPre = referrals.isLegacyConnectionHold(current.data(), signalPreData);
    const devicesOn = ipReputation.deviceEnabled();
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
    let freshGate = null;
    let ready = false;
    try {
        ready = await aboutToPayReferral(uid, referrerUid, profile, tomb);
    } catch (e) {
        console.error('[referral] payout qualify fallback');
        ready = false;
    }
    const seen = observedVerdict(extra);
    const requestIp = String(extra.requestIp || '');
    const recheckDue = (holdPre || legacyPre) && requestIp && referrals.connectionRecheckDue(holdPre || { checkedAt: 0 }, Date.now());
    const lookupIp = seen ? '' : (recheckDue ? requestIp : ((ready && !holdPre && !legacyPre) ? checkIp : ''));
    if (seen) {
        freshGate = { ipVerdict: seen };
    } else if (lookupIp) {
        try {
            freshGate = await ipReputation.assessReward({
                db: db(),
                ip: lookupIp,
                uid: uid,
                purpose: 'referral',
                userAgent: extra.userAgent || '',
                language: extra.language || '',
            });
        } catch (e) {
            console.error('[referral] payout recheck fallback');
            freshGate = null;
        }
    }
    const referrerRef = db().collection('users').doc(referrerUid);
    const referredLedgerRef = db().collection('faucet_ledger').doc(uid);
    const referrerLedgerRef = db().collection('faucet_ledger').doc(referrerUid);
    const limitRef = db().collection('referral_pay_limits').doc(referrerUid);
    const referredHoldRef = db().collection('device_holds').doc(uid);
    const referredDeviceRef = db().collection('user_devices').doc(uid);
    const referrerDeviceRef = db().collection('user_devices').doc(referrerUid);
    const referredHistRef = db().collection('email_history').doc(uid);
    const referrerHistRef = db().collection('email_history').doc(referrerUid);

    let outcome = { paid: false, reason: 'skip' };
    await db().runTransaction(async function(t) {
        const reads = [
            t.get(refRef),
            t.get(referredRef),
            t.get(referrerRef),
            t.get(signalRef),
            t.get(referredLedgerRef),
            t.get(referrerLedgerRef),
            t.get(limitRef),
            t.get(referredHistRef),
            t.get(referrerHistRef),
        ];
        if (devicesOn) {
            reads.push(t.get(referredHoldRef), t.get(referredDeviceRef), t.get(referrerDeviceRef));
        }
        const got = await Promise.all(reads);
        const referralDoc = got[0];
        const referredDoc = got[1];
        const referrerDoc = got[2];
        const signalDoc = got[3];
        const referredLedger = got[4];
        const referrerLedger = got[5];
        const limitDoc = got[6];
        const referredHist = got[7];
        const referrerHist = got[8];
        const referredHold = devicesOn ? got[9] : { exists: false };
        const referredDevice = devicesOn ? got[10] : { exists: false };
        const referrerDevice = devicesOn ? got[11] : { exists: false };
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
        const storedAction = String(signal.ipqsAction || '');
        const verdict = liveIpVerdict(freshGate);
        const liveAction = verdict ? verdict.action : '';
        referredView.ipqsAction = liveAction || storedAction;
        referredView.ipqsReason = verdict ? String(verdict.reason || '') : String(signal.ipqsReason || '');
        if (liveAction && liveAction !== storedAction) {
            t.set(signalRef, {
                ipqsAction: liveAction,
                ipqsReason: String(verdict.reason || '').slice(0, 40),
                ipqsFraudScore: verdict.fraudScore == null ? null : verdict.fraudScore,
                ipqsCheckedAtMs: Date.now(),
            }, { merge: true });
        }
        if (devicesOn) {
            referredView.deviceHmac = String(signal.deviceHmac || '');
            if (!referredView.deviceHmac && referredDevice.exists) {
                referredView.deviceHmac = String((referredDevice.data() || {}).deviceHmac || '');
            }
            if (referrerDevice.exists) {
                referrerView.deviceHmac = String((referrerDevice.data() || {}).deviceHmac || '');
            }
        }
        const hold = referredHold.exists ? (referredHold.data() || {}) : null;
        const holdExp = hold ? millisOf(hold.expireAt) : 0;
        if (hold && hold.approved !== true && hold.held === true && (!holdExp || holdExp > Date.now())) {
            referredView.deviceAction = hold.reason === 'device-fraud' ? 'deny' : 'hold';
        }
        const recentPaidAt = limitDoc.exists ? (limitDoc.data().paidAtMs || []) : [];
        const decision = referrals.assessReferralPayout({
            hasSignal: true,
            nowMs: Date.now(),
            recentPaidAt: recentPaidAt,
            referral: referralDoc.data(),
            signal: signal,
            serverVerdict: verdict,
            referred: referredView,
            referrer: referrerView,
            signupIpHmac: storedHmac,
        });
        const clearFlags = { rejectionFlags: admin.firestore.FieldValue.delete() };
        const dropHold = { ipqsHold: admin.firestore.FieldValue.delete() };
        if (decision.action === 'legacy') {
            t.update(refRef, Object.assign({ status: 'legacy' }, clearFlags));
            outcome = { paid: false, reason: 'legacy' };
            return;
        }
        if (decision.action === 'hold') {
            const nextHold = decision.ipqsHold || {};
            let checkedAt = Number(nextHold.checkedAt) || Date.now();
            if (lookupIp && !liveIpVerdict(freshGate)) checkedAt = Date.now();
            t.update(refRef, Object.assign({
                status: 'held_connection',
                ticketsAwarded: false,
                verified: false,
            }, clearFlags));
            t.set(signalRef, {
                ipqsHold: {
                    reason: String(nextHold.reason || 'vpn').slice(0, 16),
                    since: Number(nextHold.since) || Date.now(),
                    checkedAt: checkedAt,
                },
                ipqsAction: 'hold',
                ipqsReason: String(nextHold.reason || 'vpn').slice(0, 40),
                ipqsCheckedAtMs: checkedAt,
                flags: ['ipqs-hold'],
            }, { merge: true });
            outcome = { paid: false, reason: decision.reason, held: true };
            return;
        }
        if (decision.action === 'clear') {
            t.update(refRef, Object.assign({
                status: 'pending',
                ticketsAwarded: false,
                verified: false,
            }, clearFlags));
            t.set(signalRef, Object.assign({
                ipqsAction: 'allow',
                ipqsReason: 'clean',
                ipqsCheckedAtMs: Date.now(),
                flags: [],
            }, dropHold), { merge: true });
            outcome = { paid: false, reason: decision.reason, cleared: true };
            return;
        }
        if (decision.action === 'expire') {
            t.update(refRef, Object.assign({
                status: 'expired',
                ticketsAwarded: false,
                verified: false,
            }, clearFlags));
            t.set(signalRef, Object.assign({
                ipqsAction: 'hold',
                ipqsReason: 'expired',
                flags: ['ipqs-hold-expired'],
            }, dropHold), { merge: true });
            outcome = { paid: false, reason: 'connection-hold-expired' };
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
            t.set(signalRef, Object.assign({ flags: decision.flags || [] }, dropHold), { merge: true });
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
        t.set(signalRef, Object.assign({
            ipqsAction: 'allow',
            ipqsReason: 'clean',
            ipqsCheckedAtMs: nowMs,
            flags: [],
        }, dropHold), { merge: true });
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
    if (outcome && outcome.paid && outcome.referrerUid) {
        try {
            const { grantFamily, familyFor } = require('./grantBadge');
            await grantFamily(db(), admin, outcome.referrerUid, familyFor('referralCount'));
        } catch (e) {
            console.warn('[referral] badges', e && e.message ? e.message : e);
        }
    }
    return outcome;
}

async function onUserWritten(event) {
    const afterSnap = event.data && event.data.after;
    if (!afterSnap || !afterSnap.exists) return null;
    const uid = event.params.uid;
    const beforeSnap = event.data && event.data.before;
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
    try {
        if (!after.referralCode) await ensureReferralCode(uid);
        const crossed = referrals.crossedMaxi(before.points, after.points);
        const referredByNew = !!after.referredBy && after.referredBy !== before.referredBy;
        const atMaxi = (Number(after.points) || 0) >= referrals.MAXI_POINTS;
        if (crossed || (referredByNew && atMaxi)) await payIfQualified(uid);
    } catch (e) {
        console.error('[onUserReferral]', e && e.message ? e.message : e);
    }
    return null;
}

async function scanStatus(status, cursorName, cap) {
    const stateRef = db().collection('referral_scan').doc(cursorName);
    const state = await stateRef.get();
    const cursor = state.exists ? String(state.data().cursor || '') : '';
    let query = db().collection('referrals')
        .where('status', '==', status)
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(cap);
    if (cursor) query = query.startAfter(cursor);
    let snap = await query.get();
    if (snap.empty && cursor) {
        snap = await db().collection('referrals')
            .where('status', '==', status)
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

async function scanLegacyConnection(cap) {
    const stateRef = db().collection('referral_scan').doc('legacy_hold');
    const state = await stateRef.get();
    const cursor = state.exists ? String(state.data().cursor || '') : '';
    let query = db().collection('referrals')
        .where('status', '==', 'flagged')
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(cap);
    if (cursor) query = query.startAfter(cursor);
    let snap = await query.get();
    if (snap.empty && cursor) {
        snap = await db().collection('referrals')
            .where('status', '==', 'flagged')
            .orderBy(admin.firestore.FieldPath.documentId())
            .limit(cap)
            .get();
    }
    let paid = 0;
    let scanned = 0;
    for (let i = 0; i < snap.docs.length; i++) {
        try {
            const signalSnap = await db().collection('referral_signals').doc(snap.docs[i].id).get();
            const signal = signalSnap.exists ? (signalSnap.data() || {}) : {};
            if (!referrals.isLegacyConnectionHold(snap.docs[i].data() || {}, signal)) continue;
            scanned++;
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
    return { scanned: scanned, paid: paid, cursor: next };
}

async function scanPending(limit) {
    const cap = Math.max(1, Math.min(40, Number(limit) || 40));
    const pending = await scanStatus('pending', 'pending', cap);
    const held = await scanStatus('held_connection', 'held', cap);
    const legacy = await scanLegacyConnection(Math.min(10, cap));
    return {
        scanned: pending.scanned + held.scanned + legacy.scanned,
        paid: pending.paid + held.paid + legacy.paid,
        cursor: pending.cursor,
    };
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
    lookupReferrerUid: lookupReferrerUid,
    deleteMyReferralSignal: deleteMyReferralSignal,
};
