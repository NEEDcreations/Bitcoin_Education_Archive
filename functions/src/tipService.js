'use strict';

// confirmTipSent records one tip confirmation per UTC day.
// Today's lock is read before any network call. A LUD-21 host is resolved
// and rejected if it is internal before it is fetched. The NWC wallet is
// not queried until that guard passes. XP is awarded only after verification.

const functionsV1 = require('firebase-functions/v1');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const bolt11 = require('bolt11');
const tipConfirm = require('./tipConfirm');
const doubleXp = require('./doubleXp');
const referrals = require('./referrals');
const { assertPublicHost } = require('./publicHost');
const { applyDailyXp } = require('./applyDailyXp');
const { paymentHashFromDecoded, rewardBlocked } = require('./cipherClaim');
const tipBadge = require('./tipBadge');

const NWC_URL = process.env.NWC_URL || '';

function db() {
    return admin.firestore();
}

function httpsError(code, message) {
    return new functionsV1.https.HttpsError(code, message);
}

function requireUser(context) {
    if (!context || !context.auth) throw httpsError('unauthenticated', 'Must be signed in');
    if (context.auth.token && context.auth.token.firebase && context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw httpsError('permission-denied', 'Sign in to record a tip');
    }
    return context.auth.uid;
}

function offsetDateKey(nowMs) {
    const shifted = new Date((Number(nowMs) || Date.now()) - 5 * 3600 * 1000);
    return shifted.toISOString().split('T')[0];
}

function hashFromInvoice(invoice) {
    const text = String(invoice || '').trim();
    if (!text || text.length > 8000) return '';
    try {
        return tipConfirm.normalizePaymentHash(paymentHashFromDecoded(bolt11.decode(text)));
    } catch (e) {
        return '';
    }
}

function invoiceSats(invoice) {
    const text = String(invoice || '').trim();
    if (!text || text.length > 8000) return 0;
    try {
        const decoded = bolt11.decode(text);
        let sats = 0;
        if (decoded && Number(decoded.satoshis) > 0) sats = Math.floor(Number(decoded.satoshis));
        else if (decoded && Number(decoded.millisatoshis) > 0) sats = Math.floor(Number(decoded.millisatoshis) / 1000);
        if (!Number.isFinite(sats) || sats <= 0) return 0;
        return Math.min(sats, 1000000000);
    } catch (e) {
        return 0;
    }
}

async function tryLud21(verifyUrl, expectedHash) {
    const safe = String(verifyUrl || '');
    if (safe.indexOf('https://') !== 0) return { verified: false, reason: 'no-verify-url' };
    try {
        const res = await fetch(safe, { timeout: 4000, size: 65536, redirect: 'manual' });
        if (res.status !== 200) return { verified: false, reason: 'lud21-unverified' };
        const body = await res.json();
        const prHash = hashFromInvoice(body && body.pr) || tipConfirm.normalizePaymentHash(body && (body.prHash || body.payment_hash || body.paymentHash || body.pr));
        return tipConfirm.interpretLud21(200, Object.assign({}, body, { prHash: prHash }), expectedHash);
    } catch (e) {
        return { verified: false, reason: 'lud21-unverified' };
    }
}

async function tryNwc(paymentHash) {
    const hash = tipConfirm.normalizePaymentHash(paymentHash);
    if (!hash || !NWC_URL) return { verified: false, reason: NWC_URL ? 'no-payment-hash' : 'nwc-not-configured' };
    try {
        const { NWCClient } = require('@getalby/sdk');
        const nwc = new NWCClient({ nostrWalletConnectUrl: NWC_URL });
        const lookup = nwc.lookupInvoice({ payment_hash: hash });
        const invoice = await Promise.race([
            lookup,
            new Promise(function(_, reject) {
                setTimeout(function() { reject(new Error('nwc-timeout')); }, 4000);
            }),
        ]);
        return tipConfirm.interpretNwcLookup(invoice, hash);
    } catch (e) {
        return { verified: false, reason: 'nwc-not-found' };
    }
}

function domainOfAddress(address) {
    const text = String(address || '').trim().toLowerCase();
    const at = text.lastIndexOf('@');
    if (at < 1 || at === text.length - 1) return '';
    const host = text.slice(at + 1);
    if (!/^[a-z0-9.-]+$/.test(host) || host.indexOf('..') !== -1) return '';
    return host;
}

async function recipientLightning(recipientUid) {
    const pub = await db().collection('public_profiles').doc(recipientUid).get();
    if (!pub.exists) return '';
    const data = pub.data() || {};
    return String(data.lightningAddress || data.lightning || data.lnAddress || '').trim().toLowerCase();
}

async function linkedTip(callerUid, recipientUid) {
    const [leftDoc, rightDoc] = await Promise.all([
        db().collection('users').doc(callerUid).get(),
        db().collection('users').doc(recipientUid).get(),
    ]);
    const left = Object.assign({ uid: callerUid }, leftDoc.exists ? leftDoc.data() : {});
    const right = Object.assign({ uid: recipientUid }, rightDoc.exists ? rightDoc.data() : {});
    const flags = referrals.fraudFlags(left, right, '');
    return flags.some(function(flag) {
        return flag === 'self' || flag === 'same-fingerprint' || flag === 'same-email' || flag === 'same-lightning';
    });
}

async function verifyPayment(data, callerUid) {
    const decodedHash = hashFromInvoice(data && data.invoice);
    const clientHash = tipConfirm.normalizePaymentHash(data && data.paymentHash);
    if (decodedHash && clientHash && decodedHash !== clientHash) {
        return { verified: false, reason: 'hash-mismatch', paymentHash: '' };
    }
    const paymentHash = decodedHash || clientHash;
    const recipientUid = String((data && data.recipientUid) || '').trim();
    if (!recipientUid || recipientUid === callerUid) {
        return { verified: false, reason: recipientUid ? 'self-tip' : 'no-recipient', paymentHash: paymentHash };
    }
    const domain = domainOfAddress(await recipientLightning(recipientUid));
    if (!domain) return { verified: false, reason: 'no-lightning-address', paymentHash: paymentHash };
    if (await linkedTip(callerUid, recipientUid)) {
        return { verified: false, reason: 'linked-account', paymentHash: paymentHash };
    }
    const supplied = String((data && data.verifyUrl) || '').trim();
    if (!supplied) return { verified: false, reason: 'no-verify-url', paymentHash: paymentHash };
    const safe = tipConfirm.safeVerifyUrl(data.verifyUrl);
    if (!safe) return { verified: false, reason: 'bad-verify-url', paymentHash: paymentHash };
    let host = '';
    try { host = new URL(safe).hostname.toLowerCase(); } catch (e) {
        return { verified: false, reason: 'bad-verify-url', paymentHash: paymentHash };
    }
    if (host !== domain) return { verified: false, reason: 'verify-host-mismatch', paymentHash: paymentHash };
    try {
        await assertPublicHost(host);
    } catch (e) {
        return { verified: false, reason: 'verify-host-blocked', paymentHash: paymentHash };
    }
    const lud = await tryLud21(safe, paymentHash);
    if (lud.verified) return Object.assign({ paymentHash: paymentHash }, lud);
    if (paymentHash) {
        const nwc = await tryNwc(paymentHash);
        if (nwc.verified) return Object.assign({ paymentHash: paymentHash }, nwc);
        return { verified: false, reason: lud.reason || nwc.reason || 'lud21-unverified', paymentHash: paymentHash };
    }
    return { verified: false, reason: lud.reason || 'lud21-unverified', paymentHash: '' };
}

async function takeRate(docId, now) {
    const ref = db().collection('rate_limits').doc(docId);
    let decision = { ok: false, reason: 'rate' };
    await db().runTransaction(async function(t) {
        const snap = await t.get(ref);
        const prev = snap.exists ? snap.data() : {};
        decision = tipConfirm.tipRateDecision({
            lastMs: prev.lastCall,
            windowStart: prev.windowStart,
            count: prev.count || 0,
        }, now);
        if (!decision.ok) return;
        t.set(ref, {
            lastCall: admin.firestore.Timestamp.fromMillis(decision.lastMs),
            windowStart: admin.firestore.Timestamp.fromMillis(decision.windowStart),
            count: decision.count,
        });
    });
    return decision;
}

async function takeTipRate(uid, now) {
    return takeRate('tip_' + uid, now);
}

async function takeTipInvoiceRate(uid, now) {
    return takeRate('tip_invoice_' + uid, now);
}

async function confirmTipSent(data, context) {
    const uid = requireUser(context);
    const now = Date.now();
    const today = tipConfirm.utcDateKey(now);
    const capDay = offsetDateKey(now);
    const challengeId = tipConfirm.challengeIdForDate(today);

    const userRef = db().collection('users').doc(uid);
    const lockRef = userRef.collection('tip_confirmations').doc(today);
    const existingLock = await lockRef.get();
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw httpsError('not-found', 'User not found');
    const confirmedDate = existingLock.exists ? today : ((userSnap.data() || {}).tipConfirmedDate || '');
    const early = tipConfirm.decideTipConfirm({
        today: today,
        challengeId: challengeId,
        confirmedDate: confirmedDate,
        verified: false,
    });
    if (early.already) {
        return {
            success: true,
            already: true,
            awarded: 0,
            verified: existingLock.exists ? !!existingLock.data().verified : false,
            challengeCompleted: false,
            challengeId: challengeId,
        };
    }

    const rate = await takeTipRate(uid, now);
    if (!rate.ok) throw httpsError('resource-exhausted', 'Too many tip checks. Wait a moment and try again.');

    let verification = { verified: false, reason: 'not-tip-day', paymentHash: '' };
    const badgeAttempt = !!String((data && data.recipientUid) || '').trim();
    if (tipConfirm.isTippingChallenge(challengeId) || badgeAttempt) {
        verification = await verifyPayment(data || {}, uid);
    }
    if (verification.verified && verification.paymentHash) {
        const used = await db().collection('tip_hashes').doc(verification.paymentHash).get();
        if (used.exists) {
            return {
                success: false,
                already: false,
                awarded: 0,
                verified: false,
                verifyReason: 'hash-used',
                challengeCompleted: false,
                challengeId: challengeId,
            };
        }
    }
    const call = tipConfirm.decideTipConfirm({
        today: today,
        challengeId: challengeId,
        confirmedDate: '',
        verified: !!verification.verified,
    });
    if (!call.record) {
        return {
            success: false,
            already: false,
            awarded: 0,
            verified: false,
            verifyReason: verification.reason || call.reason || 'unverified',
            challengeCompleted: false,
            challengeId: challengeId,
        };
    }
    // A server-invoice badge check that has not settled yet must not lock the
    // day. The client can confirm again after the payment is visible.
    if (badgeAttempt && !tipConfirm.isTippingChallenge(challengeId) && !verification.verified) {
        return {
            success: false,
            already: false,
            awarded: 0,
            verified: false,
            verifyReason: verification.reason || 'unverified',
            challengeCompleted: false,
            challengeId: challengeId,
            tipsCounted: false,
        };
    }

    const hashRef = (verification.verified && verification.paymentHash)
        ? db().collection('tip_hashes').doc(verification.paymentHash)
        : null;
    const recipientUid = String((data && data.recipientUid) || '').trim();
    const recipientRef = (hashRef && recipientUid) ? db().collection('users').doc(recipientUid) : null;
    const invoiceRef = hashRef
        ? db().collection('tip_invoices').doc(verification.paymentHash)
        : null;
    const pairRef = (hashRef && recipientUid)
        ? db().collection('tip_pair_days').doc(uid + '_' + recipientUid + '_' + today)
        : null;
    const senderLedgerRef = hashRef ? db().collection('faucet_ledger').doc(uid) : null;
    const recipientLedgerRef = (hashRef && recipientUid) ? db().collection('faucet_ledger').doc(recipientUid) : null;
    let result = null;

    await db().runTransaction(async function(t) {
        const reads = [t.get(userRef), t.get(lockRef)];
        if (hashRef) reads.push(t.get(hashRef));
        if (recipientRef) reads.push(t.get(recipientRef));
        if (invoiceRef) reads.push(t.get(invoiceRef));
        if (pairRef) reads.push(t.get(pairRef));
        if (senderLedgerRef) reads.push(t.get(senderLedgerRef));
        if (recipientLedgerRef) reads.push(t.get(recipientLedgerRef));
        const docs = await Promise.all(reads);
        let cursor = 2;
        const userDoc = docs[0];
        const lockDoc = docs[1];
        const hashDoc = hashRef ? docs[cursor++] : null;
        const recipientDoc = recipientRef ? docs[cursor++] : null;
        const invoiceDoc = invoiceRef ? docs[cursor++] : null;
        const pairDoc = pairRef ? docs[cursor++] : null;
        const senderLedgerDoc = senderLedgerRef ? docs[cursor++] : null;
        const recipientLedgerDoc = recipientLedgerRef ? docs[cursor++] : null;
        if (hashDoc && hashDoc.exists) {
            result = {
                success: false,
                already: false,
                awarded: 0,
                verified: false,
                verifyReason: 'hash-used',
                challengeCompleted: false,
                challengeId: challengeId,
            };
            return;
        }
        if (!userDoc.exists) throw httpsError('not-found', 'User not found');
        const user = userDoc.data() || {};
        const confirmedDate = lockDoc.exists ? today : (user.tipConfirmedDate || '');
        if (confirmedDate === today) {
            result = {
                success: true,
                already: true,
                awarded: 0,
                verified: lockDoc.exists ? !!lockDoc.data().verified : false,
                challengeCompleted: false,
                challengeId: challengeId,
            };
            return;
        }
        const boost = doubleXp.boostPoints(call.awardXp, user, now);
        const senderLedger = senderLedgerDoc && senderLedgerDoc.exists ? (senderLedgerDoc.data() || {}) : {};
        const split = await applyDailyXp(uid, rewardBlocked(user, senderLedger) ? 0 : boost.points, t, {
            day: capDay,
            userRef: userRef,
        });
        const userUpdate = { tipConfirmedDate: today };
        if (call.challengeCompleted) userUpdate.tipChallengeDate = today;
        if (split.awarded > 0) {
            userUpdate.points = admin.firestore.FieldValue.increment(split.awarded);
            userUpdate.weeklyXP = admin.firestore.FieldValue.increment(split.awarded);
            userUpdate.monthlyXP = admin.firestore.FieldValue.increment(split.awarded);
            t.set(split.dailyRef, {
                total: split.dailyXp,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        let tipsCounted = false;
        let countedSats = 0;
        if (hashRef && invoiceRef && recipientRef) {
            const stored = invoiceDoc && invoiceDoc.exists ? (invoiceDoc.data() || {}) : null;
            const decision = tipBadge.decide({
                senderUid: uid,
                recipientUid: recipientUid,
                stored: stored,
                verifyUrl: (data && data.verifyUrl) || '',
                sender: user,
                recipient: recipientDoc && recipientDoc.exists ? (recipientDoc.data() || {}) : {},
                senderLedger: senderLedgerDoc && senderLedgerDoc.exists ? (senderLedgerDoc.data() || {}) : {},
                recipientLedger: recipientLedgerDoc && recipientLedgerDoc.exists ? (recipientLedgerDoc.data() || {}) : {},
                pairUsed: !!(pairDoc && pairDoc.exists),
                decodedSats: stored ? invoiceSats(stored.invoice) : 0,
            });
            if (decision.credit) {
                userUpdate.tipsVerified = admin.firestore.FieldValue.increment(1);
                if (decision.sats > 0) userUpdate.tipsSentSats = admin.firestore.FieldValue.increment(decision.sats);
                countedSats = decision.sats;
                tipsCounted = true;
                t.set(pairRef, {
                    senderUid: uid,
                    recipientUid: recipientUid,
                    day: today,
                    paymentHash: verification.paymentHash,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
        }
        t.update(userRef, userUpdate);
        let creditedRecipient = '';
        if (tipsCounted && recipientDoc && recipientDoc.exists) {
            t.update(recipientRef, { tipsReceived: admin.firestore.FieldValue.increment(1) });
            creditedRecipient = recipientUid;
        }
        if (hashRef) {
            t.set(hashRef, {
                uid: uid,
                recipientUid: String((data && data.recipientUid) || ''),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        t.set(lockRef, {
            uid: uid,
            date: today,
            challengeId: challengeId,
            verified: !!verification.verified,
            verifyReason: verification.reason || 'confirmation',
            paymentHash: verification.paymentHash || '',
            awarded: split.awarded,
            doubled: !!boost.doubled,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const note = userRef.collection('notifications').doc();
        const xpText = split.awarded > 0 ? (' +' + split.awarded + ' XP' + (boost.doubled ? ' (2×)' : '') + '.') : '.';
        const body = call.challengeCompleted
            ? ('Tipping challenge complete' + xpText)
            : ('Tip recorded' + (verification.verified ? ' and verified' : '') + xpText);
        t.set(note, {
            type: 'tip_confirmed',
            title: verification.verified ? '⚡ Tip verified' : '⚡ Tip recorded',
            body: body,
            read: false,
            ts: admin.firestore.FieldValue.serverTimestamp(),
        });
        t.set(db().collection('notifications').doc(), {
            recipientId: uid,
            senderId: 'system',
            senderName: 'Lightning',
            type: 'tip_confirmed',
            message: body,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        result = {
            success: true,
            already: false,
            awarded: split.awarded,
            overflowAdded: split.overflowAdded,
            doubled: !!boost.doubled,
            verified: !!verification.verified,
            verifyReason: verification.reason || 'confirmation',
            challengeCompleted: !!call.challengeCompleted,
            challengeId: challengeId,
            tipsCounted: tipsCounted,
            tipsSentSats: tipsCounted ? countedSats : 0,
            recipientUid: creditedRecipient,
        };
    });
    if (result && result.tipsCounted) {
        try {
            const { grantFamily, familyFor } = require('./grantBadge');
            const ids = familyFor('tipsVerified').slice();
            if (result.tipsSentSats > 0) ids.push.apply(ids, familyFor('tipsSentSats'));
            await grantFamily(db(), admin, uid, ids);
            if (result.recipientUid) {
                await grantFamily(db(), admin, result.recipientUid, familyFor('tipsReceived'));
            }
        } catch (tipBadgeErr) {
            console.warn('[TIP] badges', tipBadgeErr && tipBadgeErr.message);
        }
    }
    return result || { success: false, awarded: 0 };
}

const TIP_FETCH_HOPS = 3;
const TIP_REDIRECTS = { 301: true, 302: true, 303: true, 307: true, 308: true };

async function fetchAllowlisted(startUrl) {
    let current = String(startUrl || '');
    for (let hop = 0; hop < TIP_FETCH_HOPS; hop++) {
        let parsed;
        try { parsed = new URL(current); } catch (e) {
            throw httpsError('unavailable', 'Could not reach that wallet');
        }
        if (parsed.protocol !== 'https:') throw httpsError('unavailable', 'Could not reach that wallet');
        const host = parsed.hostname.toLowerCase();
        if (!tipBadge.hostAllowed(host)) throw httpsError('failed-precondition', 'That wallet is not on the tip list');
        try {
            await assertPublicHost(host);
        } catch (e) {
            throw httpsError('failed-precondition', 'That wallet is not on the tip list');
        }
        const res = await fetch(parsed.toString(), { timeout: 8000, size: 65536, redirect: 'manual' });
        if (TIP_REDIRECTS[res.status]) {
            const location = res.headers.get('location');
            if (!location || hop === TIP_FETCH_HOPS - 1) throw httpsError('unavailable', 'Could not reach that wallet');
            let next;
            try { next = new URL(location, parsed); } catch (e) {
                throw httpsError('unavailable', 'Could not reach that wallet');
            }
            if (next.protocol !== 'https:') throw httpsError('unavailable', 'Could not reach that wallet');
            current = next.toString();
            continue;
        }
        return res;
    }
    throw httpsError('unavailable', 'Could not reach that wallet');
}

async function fetchLnurlInvoice(address, amountSats) {
    const text = String(address || '').trim().toLowerCase();
    const at = text.lastIndexOf('@');
    if (at < 1) throw httpsError('failed-precondition', 'That wallet has no Lightning address');
    const localPart = text.slice(0, at);
    const domain = text.slice(at + 1).split(':')[0];
    if (!domain || domain.indexOf('..') !== -1) throw httpsError('failed-precondition', 'That wallet has no Lightning address');
    if (!tipBadge.hostAllowed(domain)) throw httpsError('failed-precondition', 'That wallet is not on the tip list');
    const metaRes = await fetchAllowlisted('https://' + domain + '/.well-known/lnurlp/' + encodeURIComponent(localPart));
    if (!metaRes.ok) throw httpsError('unavailable', 'Could not reach that wallet');
    const meta = await metaRes.json();
    if (!meta || !meta.callback) throw httpsError('unavailable', 'Could not reach that wallet');
    let cbUrl;
    try { cbUrl = new URL(meta.callback); } catch (e) {
        throw httpsError('unavailable', 'Could not reach that wallet');
    }
    if (cbUrl.protocol !== 'https:' || !tipBadge.hostAllowed(cbUrl.hostname.toLowerCase())) {
        throw httpsError('unavailable', 'Could not reach that wallet');
    }
    const msats = amountSats * 1000;
    if (meta.minSendable && msats < meta.minSendable) throw httpsError('invalid-argument', 'Amount is below that wallet minimum');
    if (meta.maxSendable && msats > meta.maxSendable) throw httpsError('invalid-argument', 'Amount is above that wallet maximum');
    const sep = String(meta.callback).indexOf('?') === -1 ? '?' : '&';
    const invoiceRes = await fetchAllowlisted(meta.callback + sep + 'amount=' + msats);
    if (!invoiceRes.ok) throw httpsError('unavailable', 'Could not reach that wallet');
    const invoiceData = await invoiceRes.json();
    const pr = invoiceData && invoiceData.pr;
    if (!pr || String(pr).toLowerCase().indexOf('lnbc') !== 0) throw httpsError('unavailable', 'Could not reach that wallet');
    const verifyUrl = invoiceData && invoiceData.verify ? String(invoiceData.verify) : '';
    return { invoice: String(pr), verifyUrl: verifyUrl };
}

async function requestTipInvoice(data, context) {
    const uid = requireUser(context);
    const recipientUid = String((data && data.recipientUid) || '').trim();
    if (!recipientUid || recipientUid === uid) throw httpsError('invalid-argument', 'Pick someone else');
    const amount = Math.floor(Number(data && data.amountSats) || 0);
    if (amount < 1 || amount > 100000000) throw httpsError('invalid-argument', 'Amount out of range');
    const [senderSnap, recipientSnap, senderLedgerSnap, recipientLedgerSnap] = await Promise.all([
        db().collection('users').doc(uid).get(),
        db().collection('users').doc(recipientUid).get(),
        db().collection('faucet_ledger').doc(uid).get(),
        db().collection('faucet_ledger').doc(recipientUid).get(),
    ]);
    if (!senderSnap.exists || !recipientSnap.exists) throw httpsError('not-found', 'User not found');
    const sender = senderSnap.data() || {};
    const recipient = recipientSnap.data() || {};
    const senderLedger = senderLedgerSnap.exists ? (senderLedgerSnap.data() || {}) : {};
    const recipientLedger = recipientLedgerSnap.exists ? (recipientLedgerSnap.data() || {}) : {};
    if (rewardBlocked(sender, senderLedger) || rewardBlocked(recipient, recipientLedger)) {
        throw httpsError('permission-denied', 'Not allowed');
    }
    if (tipBadge.sharesCluster(sender, recipient)) throw httpsError('permission-denied', 'Not allowed');
    const address = await recipientLightning(recipientUid);
    if (!address) throw httpsError('failed-precondition', 'That wallet has no Lightning address');
    const rate = await takeTipInvoiceRate(uid, Date.now());
    if (!rate.ok) throw httpsError('resource-exhausted', 'Too many tip invoices. Wait a moment and try again.');
    const fetched = await fetchLnurlInvoice(address, amount);
    const pr = fetched.invoice;
    const paymentHash = hashFromInvoice(pr);
    const sats = invoiceSats(pr);
    if (!paymentHash || sats !== amount) throw httpsError('failed-precondition', 'Wallet returned an unexpected invoice');
    const ref = db().collection('tip_invoices').doc(paymentHash);
    const existing = await ref.get();
    if (existing.exists) {
        const row = existing.data() || {};
        if (row.senderUid === uid && row.recipientUid === recipientUid && row.sats === sats) {
            return { success: true, invoice: row.invoice, paymentHash: paymentHash, sats: sats, verifyUrl: fetched.verifyUrl || '' };
        }
        throw httpsError('already-exists', 'Invoice already used');
    }
    await ref.set({
        senderUid: uid,
        recipientUid: recipientUid,
        sats: sats,
        paymentHash: paymentHash,
        invoice: pr,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, invoice: pr, paymentHash: paymentHash, sats: sats, verifyUrl: fetched.verifyUrl || '' };
}

module.exports = {
    confirmTipSent: confirmTipSent,
    requestTipInvoice: requestTipInvoice,
    verifyPayment: verifyPayment,
    hashFromInvoice: hashFromInvoice,
};
