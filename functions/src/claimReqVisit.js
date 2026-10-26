'use strict';

// Logs a referral-link visit and, when the visit is a different device and
// a different network than the player's known HMACs, stamps claimReq.referralAt.
// Raw IPs are never stored or logged. App Check is required. Calls are rate
// limited per IP HMAC and per referral code.

const crypto = require('crypto');
const referrals = require('./referrals');
const claimReqs = require('./claimReqs');
const ipHmac = require('./ipHmac');
const faucetGuard = require('./faucetGuard');

function httpsError(HttpsError, code, message) {
    return new HttpsError(code, message);
}

function documentIdField() {
    const admin = require('firebase-admin');
    return admin.firestore.FieldPath.documentId();
}

function findOwner(db, code) {
    const normalized = referrals.normalizeCode(code);
    if (!normalized) return Promise.resolve('');
    return db.collection('referralCodes').doc(normalized).get().then(function (codeDoc) {
        if (codeDoc.exists && codeDoc.data() && codeDoc.data().uid) return String(codeDoc.data().uid);
        return db.collection('users').where('referralCode', '==', normalized).limit(2).get().then(function (byField) {
            if (byField.size === 1) return byField.docs[0].id;
            if (byField.size > 1) return '';
            return db.collection('users')
                .orderBy(documentIdField())
                .startAt(normalized)
                .endAt(normalized + '\uf8ff')
                .limit(5)
                .get()
                .then(function (prefix) {
                    const hits = prefix.docs.filter(function (doc) {
                        return doc.id.indexOf(normalized) === 0;
                    });
                    return hits.length === 1 ? hits[0].id : '';
                });
        });
    });
}

function hmacOrEmpty(material) {
    const text = String(material || '');
    if (!text) return '';
    return ipHmac.hmacIp(text);
}

function deviceMaterial(raw) {
    const id = faucetGuard.fingerprintDocId(raw);
    return id ? ('device:' + id) : '';
}

function ipMaterials(value) {
    const raw = Array.isArray(value) ? value : String(value || '').split(/[,\s]+/);
    const hmacs = [];
    const pending = [];
    raw.forEach(function (item) {
        const text = String(item || '').trim();
        if (!text) return;
        if (/^[a-f0-9]{64}$/i.test(text)) hmacs.push(text.toLowerCase());
        else if (faucetGuard.networkKeys(text)) pending.push(text);
    });
    pending.forEach(function (ip) {
        const mac = hmacOrEmpty(ip);
        if (mac) hmacs.push(mac);
    });
    return hmacs;
}

function handleLogReferralVisit(deps, data, context) {
    const HttpsError = deps.HttpsError;
    const db = deps.db;
    const code = referrals.normalizeCode(data && data.refCode);
    if (!code) throw httpsError(HttpsError, 'invalid-argument', 'Referral code is missing');
    const deviceId = faucetGuard.fingerprintDocId(data && data.fingerprint);
    if (!deviceId) throw httpsError(HttpsError, 'invalid-argument', 'Device check failed');
    const rawIp = faucetGuard.clientIpFromRequest(context && context.rawRequest);
    if (!rawIp || rawIp.toLowerCase() === 'unknown' || !faucetGuard.networkKeys(rawIp)) {
        throw httpsError(HttpsError, 'failed-precondition', 'Could not verify this visit');
    }
    let visitIpHmac = '';
    let visitDeviceHmac = '';
    try {
        visitIpHmac = hmacOrEmpty(rawIp);
        visitDeviceHmac = hmacOrEmpty(deviceMaterial(deviceId));
    } catch (err) {
        throw httpsError(HttpsError, 'failed-precondition', 'Visits cannot be recorded right now');
    }
    if (!visitIpHmac || !visitDeviceHmac) {
        throw httpsError(HttpsError, 'failed-precondition', 'Visits cannot be recorded right now');
    }

    const callerUid = context && context.auth && context.auth.uid ? String(context.auth.uid) : '';
    const now = Date.now();
    const ipRateRef = db.collection('rate_limits').doc('refvisit_ip_' + visitIpHmac.slice(0, 40));
    const codeRateRef = db.collection('rate_limits').doc('refvisit_code_' + code);

    return findOwner(db, code).then(function (ownerUid) {
        return db.runTransaction(function (t) {
            const userRef = ownerUid ? db.collection('users').doc(ownerUid) : null;
            const signalRef = ownerUid ? db.collection('faucet_uid_signals').doc(ownerUid) : null;
            const reads = [t.get(ipRateRef), t.get(codeRateRef)];
            if (userRef) reads.push(t.get(userRef));
            if (signalRef) reads.push(t.get(signalRef));
            return Promise.all(reads).then(function (snaps) {
                const ipRateSnap = snaps[0];
                const codeRateSnap = snaps[1];
                const userSnap = userRef ? snaps[2] : null;
                const signalSnap = signalRef ? snaps[3] : null;
                const ipRate = claimReqs.visitRateDecision(ipRateSnap.exists ? ipRateSnap.data() : {}, now, claimReqs.VISIT_IP_MAX);
                if (!ipRate.ok) return { rate: true };
                const codeRate = claimReqs.visitRateDecision(codeRateSnap.exists ? codeRateSnap.data() : {}, now, claimReqs.VISIT_CODE_MAX);
                if (!codeRate.ok) return { rate: true };
                t.set(ipRateRef, {
                    lastMs: ipRate.lastMs,
                    windowStart: ipRate.windowStart,
                    count: ipRate.count,
                });
                t.set(codeRateRef, {
                    lastMs: codeRate.lastMs,
                    windowStart: codeRate.windowStart,
                    count: codeRate.count,
                });
                if (!ownerUid || !userSnap || !userSnap.exists) return { ok: false, counted: false, reason: 'unknown-code' };

                const user = userSnap.data() || {};
                const signal = signalSnap && signalSnap.exists ? (signalSnap.data() || {}) : {};
                let known;
                try {
                    known = claimReqs.collectOwnerHmacs(user, {
                        deviceHmacs: [
                            hmacOrEmpty(deviceMaterial(user.fingerprint)),
                            hmacOrEmpty(deviceMaterial(signal.fingerprint)),
                        ],
                        ipHmacs: ipMaterials(user.known_ips),
                    });
                } catch (err) {
                    return { ok: false, counted: false, reason: 'unavailable' };
                }
                const decision = claimReqs.assessReferralVisit({
                    callerIsOwner: callerUid !== '' && callerUid === ownerUid,
                    visitDeviceHmac: visitDeviceHmac,
                    visitIpHmac: visitIpHmac,
                    ownerDeviceHmacs: known.deviceHmacs,
                    ownerIpHmacs: known.ipHmacs,
                });
                const visitId = crypto.createHash('sha256')
                    .update(code + '|' + visitDeviceHmac + '|' + visitIpHmac)
                    .digest('hex')
                    .slice(0, 40);
                const already = claimReqs.stampMillis((user.claimReq || {}).referralAt) > 0;
                const counted = decision.count === true && !already;
                t.set(db.collection('referral_visits').doc(visitId), {
                    code: code,
                    ownerUid: ownerUid,
                    deviceHmac: visitDeviceHmac,
                    ipHmac: visitIpHmac,
                    counted: counted,
                    at: deps.serverTimestamp(),
                }, { merge: true });
                const patch = {};
                if (decision.remember === true) {
                    patch['claimReq.deviceHmacs'] = claimReqs.nextKnownHmacs(known.deviceHmacs, visitDeviceHmac);
                    patch['claimReq.ipHmacs'] = claimReqs.nextKnownHmacs(known.ipHmacs, visitIpHmac);
                }
                if (counted) patch['claimReq.referralAt'] = deps.serverTimestamp();
                if (Object.keys(patch).length) t.update(userRef, patch);
                return { ok: true, counted: counted, reason: already && decision.count ? 'already' : decision.reason };
            });
        });
    }).then(function (result) {
        if (result && result.rate) {
            throw httpsError(HttpsError, 'resource-exhausted', 'Too many visits. Try again later.');
        }
        return {
            ok: !!(result && result.ok),
            counted: !!(result && result.counted),
        };
    });
}

function bindLogReferralVisit(functionsV1, deps) {
    const opts = { enforceAppCheck: true };
    if (deps && deps.secrets) opts.secrets = deps.secrets;
    const admin = deps.admin;
    return functionsV1.runWith(opts).https.onCall(function (data, context) {
        return handleLogReferralVisit({
            db: deps.db,
            HttpsError: functionsV1.https.HttpsError,
            serverTimestamp: function () { return admin.firestore.FieldValue.serverTimestamp(); },
        }, data, context);
    });
}

module.exports = {
    bindLogReferralVisit: bindLogReferralVisit,
    handleLogReferralVisit: handleLogReferralVisit,
    deviceMaterial: deviceMaterial,
    ipMaterials: ipMaterials,
};
