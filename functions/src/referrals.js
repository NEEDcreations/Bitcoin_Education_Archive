'use strict';

// Pure referral decisions. Firestore I/O lives in referralService.js.
// Nobody has been paid yet: the award is 50 orange tickets to each side,
// exactly once, when the referee reaches Maxi (2,140 points).

const MAXI_POINTS = 2140;
const REFERRAL_TICKETS = 50;
const CODE_LENGTH = 8;

const SIGNUP_WINDOW_MS = 72 * 60 * 60 * 1000;
const SIGNUP_MAX_POINTS = 100;
const REFERRAL_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MINT_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PAYOUT_MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_ACTIVE_DAYS = 3;
const REFERRAL_PAY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const REFERRAL_PAY_CAP = 5;
const SIGNAL_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const EMAIL_PROVIDERS = { password: 1, 'google.com': 1, 'apple.com': 1, 'facebook.com': 1 };

const BLOCKING_FLAGS = {
    'self': 'rejected',
    'sats-disabled': 'rejected',
    'banned': 'rejected',
    'ledger-banned': 'rejected',
    'same-fingerprint': 'flagged',
    'same-ip': 'flagged',
    'same-email': 'flagged',
    'same-lightning': 'flagged',
    'circular': 'flagged',
    'linked-account': 'flagged',
    'prior-referral': 'rejected',
};

function needsMintedReferralCode(uid) {
    return String(uid || '').indexOf('ln:') === 0;
}

function referralCodeForUid(uid) {
    if (needsMintedReferralCode(uid)) return '';
    const id = String(uid || '');
    const prefix = id.length >= CODE_LENGTH ? id.substring(0, CODE_LENGTH) : '';
    if (!/^[A-Za-z0-9]{6,28}$/.test(prefix)) return '';
    return prefix;
}

// Stable alphanumeric code for Lightning uids. The uid itself contains a
// colon, which cannot be a referral code. salt walks forward on collision.
function mintedReferralCode(uid, salt) {
    const crypto = require('crypto');
    const digest = crypto.createHash('sha256')
        .update('ln-ref-v1\0' + String(uid || '') + '\0' + String(salt == null ? 0 : salt))
        .digest();
    let out = '';
    for (let i = 0; i < CODE_LENGTH; i++) out += MINT_ALPHABET[digest[i] % MINT_ALPHABET.length];
    return out;
}

function normalizeGuestUid(raw) {
    const uid = String(raw || '').trim();
    if (!/^[A-Za-z0-9:_\-]{6,128}$/.test(uid)) return '';
    return uid;
}

function earliestServerMs(values) {
    let best = null;
    (values || []).forEach(function (value) {
        if (value == null || value === '') return;
        const n = Number(value);
        if (!isFinite(n) || n <= 0) return;
        if (best == null || n < best) best = n;
    });
    return best;
}

// Window clock. Every input is a timestamp the server already stored
// (Auth creationTime, referral_arrivals, or a guest doc created with
// request.time). A missing guest clock falls back to the account clock,
// which is the fair window for an upgrade we can verify. Callers must not
// pass a value the client sent.
function referralWindowStart(input) {
    const src = input || {};
    return earliestServerMs([src.authCreatedMs, src.serverArrivalMs, src.guestArrivalMs]);
}

function arrivalWithinWindow(nowMs, arrivalMs) {
    const now = Number(nowMs) || 0;
    const n = Number(arrivalMs);
    if (!isFinite(n) || n <= 0) return false;
    const age = now - n;
    return age <= SIGNUP_WINDOW_MS && age >= -5 * 60 * 1000;
}

// Points cap waiver for a guest who could not register until they upgraded.
// Own arrival must have been stamped anonymous by the server, or the guest
// doc must have been merged into this account by the server. A client-named
// uid is not enough.
function fairUpgradeWindow(input) {
    const src = input || {};
    if (src.ownAnonymous === true && arrivalWithinWindow(src.nowMs, src.ownArrivalMs)) return true;
    if (src.guestMergedHere === true && src.guestAnonymous === true && arrivalWithinWindow(src.nowMs, src.guestArrivalMs)) return true;
    return false;
}

function normalizeCode(raw) {
    const code = String(raw || '').trim();
    if (!/^[A-Za-z0-9]{6,28}$/.test(code)) return '';
    return code;
}

function isSelfReferral(uid, codeOrReferrerUid) {
    const id = String(uid || '');
    const other = String(codeOrReferrerUid || '');
    if (!id || !other) return false;
    if (id === other) return true;
    if (other.length >= 6 && other.length <= 28 && id.indexOf(other) === 0) return true;
    if (other.length >= 6 && id.toLowerCase().indexOf(other.toLowerCase()) === 0) return true;
    return false;
}

function crossedMaxi(beforePoints, afterPoints) {
    const before = Number(beforePoints) || 0;
    const after = Number(afterPoints) || 0;
    return before < MAXI_POINTS && after >= MAXI_POINTS;
}

function alreadyPaid(referral) {
    if (!referral) return false;
    return referral.status === 'paid' || referral.ticketsAwarded === true;
}

function lower(value) {
    return String(value || '').trim().toLowerCase();
}

function ipList(value) {
    if (!value) return [];
    const raw = Array.isArray(value) ? value : String(value).split(/[,\s]+/);
    const out = [];
    raw.forEach(function(item) {
        const ip = lower(item);
        if (ip) out.push(ip);
    });
    return out;
}

function lightningOf(user) {
    if (!user) return '';
    return lower(user.lightningAddress || user.lightning || user.lnAddress);
}

function fraudFlags(referred, referrer, signupIp) {
    const flags = [];
    if (!referred || !referrer) return flags;
    if (isSelfReferral(referred.uid, referrer.uid) || isSelfReferral(referred.uid, referrer.referralCode)) {
        flags.push('self');
    }
    if (referred.satsDisabled === true || referrer.satsDisabled === true) flags.push('sats-disabled');
    if (referred.banned === true || referrer.banned === true) flags.push('banned');
    if (referred.ledgerBanned === true || referrer.ledgerBanned === true) flags.push('ledger-banned');
    const fpA = String(referred.fingerprint || '').trim();
    const fpB = String(referrer.fingerprint || '').trim();
    if (fpA && fpB && fpA === fpB) flags.push('same-fingerprint');
    const ipsA = ipList(referred.known_ips);
    const ipsB = ipList(referrer.known_ips);
    const extra = lower(signupIp);
    if (extra) ipsA.push(extra);
    const setB = {};
    ipsB.forEach(function(ip) { setB[ip] = true; });
    for (let i = 0; i < ipsA.length; i++) {
        if (setB[ipsA[i]]) { flags.push('same-ip'); break; }
    }
    const emailA = lower(referred.email);
    const emailB = lower(referrer.email);
    if (emailA && emailB && emailA === emailB) flags.push('same-email');
    if (emailHashesOverlap(referred, referrer) && flags.indexOf('same-email') === -1) flags.push('same-email');
    const lnA = lightningOf(referred);
    const lnB = lightningOf(referrer);
    if (lnA && lnB && lnA === lnB) flags.push('same-lightning');
    const referredCode = normalizeCode(referred.referralCode) || referralCodeForUid(referred.uid);
    if (referredCode && lower(referrer.referredBy) === lower(referredCode)) flags.push('circular');
    if (referred.priorReferral === true) flags.push('prior-referral');
    return flags;
}

function emailHashList(user) {
    const out = [];
    const current = user && user.emailHash ? String(user.emailHash) : '';
    if (current) out.push(current);
    const history = user && user.emailHistoryHashes;
    if (Array.isArray(history)) {
        history.forEach(function (hash) {
            const value = String(hash || '');
            if (value && out.indexOf(value) === -1) out.push(value);
        });
    }
    return out;
}

function emailHashesOverlap(referred, referrer) {
    const left = emailHashList(referred);
    const right = emailHashList(referrer);
    if (!left.length || !right.length) return false;
    const set = {};
    left.forEach(function (hash) { set[hash] = true; });
    for (let i = 0; i < right.length; i++) {
        if (set[right[i]]) return true;
    }
    return false;
}

function statusForFlags(flags) {
    let status = 'pending';
    (flags || []).forEach(function(flag) {
        const next = BLOCKING_FLAGS[flag];
        if (next === 'rejected') status = 'rejected';
        else if (next === 'flagged' && status !== 'rejected') status = 'flagged';
    });
    return status;
}

function activityPoints(user) {
    const points = Number(user && user.points) || 0;
    const scholar = Number(user && user.scholarPoints) || 0;
    return Math.max(0, points - scholar);
}

function serverDayKey(nowMs) {
    const shifted = new Date((Number(nowMs) || Date.now()) - 5 * 3600 * 1000);
    return shifted.toISOString().split('T')[0];
}

function touchActiveDays(existing, nowMs) {
    const day = serverDayKey(nowMs);
    const list = Array.isArray(existing) ? existing.filter(function(item) { return !!item; }) : [];
    if (list.indexOf(day) === -1) list.push(day);
    return list.slice(-40);
}

function countRecentPays(paidAtMs, nowMs) {
    const now = Number(nowMs) || 0;
    return (Array.isArray(paidAtMs) ? paidAtMs : []).filter(function(ms) {
        const n = Number(ms) || 0;
        return n > 0 && now >= n && now - n < REFERRAL_PAY_WINDOW_MS;
    }).length;
}

function emailOk(user) {
    const providers = Array.isArray(user && user.providers) ? user.providers : [];
    const nonEmailOnly = providers.length > 0 && providers.every(function(provider) {
        return !EMAIL_PROVIDERS[provider];
    });
    if (nonEmailOnly) return true;
    return !!(user && user.emailVerified === true);
}

function assessReferralPayout(input) {
    const src = input || {};
    const referral = src.referral;
    const referred = src.referred;
    const referrer = src.referrer;
    if (!referral) return { action: 'skip', reason: 'no-referral' };
    if (alreadyPaid(referral)) return { action: 'skip', reason: 'already-paid' };
    if (referral.status === 'flagged' || referral.status === 'rejected' || referral.status === 'late' || referral.status === 'untrusted' || referral.status === 'legacy') {
        return { action: 'skip', reason: referral.status };
    }
    // Client-written docs have no server signal. They are never auto-paid.
    if (!src.hasSignal) return { action: 'legacy', reason: 'legacy' };
    if (!referred || !referrer || !referred.uid || !referrer.uid) return { action: 'skip', reason: 'missing-user' };
    if (referred.uid === referrer.uid) return { action: 'reject', reason: 'self', flags: ['self'] };
    if (activityPoints(referred) < MAXI_POINTS) return { action: 'skip', reason: 'below-maxi' };
    const now = Number(src.nowMs) || 0;
    const created = referred.createdMs == null ? null : Number(referred.createdMs);
    if (created == null || !isFinite(created)) return { action: 'skip', reason: 'age-unknown' };
    if (now - created < PAYOUT_MIN_AGE_MS) return { action: 'skip', reason: 'too-new' };
    const days = {};
    (Array.isArray(referred.activeDayKeys) ? referred.activeDayKeys : []).forEach(function(day) {
        if (day) days[day] = 1;
    });
    if (Object.keys(days).length < MIN_ACTIVE_DAYS) return { action: 'skip', reason: 'inactive' };
    if (!emailOk(referred)) return { action: 'skip', reason: 'email-unverified' };
    const flags = fraudFlags(referred, referrer, src.signupIpHmac || src.signupIp || '');
    const blocking = flags.filter(function(flag) { return !!BLOCKING_FLAGS[flag]; });
    if (blocking.length) {
        const status = statusForFlags(blocking);
        return { action: status === 'rejected' ? 'reject' : 'flag', reason: blocking[0], flags: blocking };
    }
    if (countRecentPays(src.recentPaidAt, now) >= REFERRAL_PAY_CAP) {
        return { action: 'flag', reason: 'referral-cap', flags: ['referral-cap'] };
    }
    return {
        action: 'pay',
        reason: 'maxi',
        ticketsEach: REFERRAL_TICKETS,
        referredUid: referred.uid,
        referrerUid: referrer.uid,
    };
}

// A referral is payable only for a new account: Auth creationTime within 72h
// (fail closed when that time is missing) and points still under a small cap.
// Outside that window the caller records `late` and never pays it.
function registrationGate(input) {
    const src = input || {};
    const now = Number(src.nowMs) || 0;
    const created = src.createdMs == null ? null : Number(src.createdMs);
    const points = Number(src.points) || 0;
    if (src.self) return { ok: false, status: 'rejected', reason: 'self', record: false };
    if (created == null || !isFinite(created)) {
        return { ok: false, status: 'late', reason: 'age-unknown', record: false };
    }
    const age = now - created;
    if (age > SIGNUP_WINDOW_MS || age < -5 * 60 * 1000) {
        return { ok: false, status: 'late', reason: 'account-age', record: true };
    }
    // fairWindow is set by the service only after it reads a server arrival
    // for a guest upgrade. The points cap still applies to every other account.
    if (src.fairWindow !== true && points > SIGNUP_MAX_POINTS) {
        return { ok: false, status: 'late', reason: 'points', record: true };
    }
    if (src.linked) {
        return { ok: false, status: 'flagged', reason: 'linked-account', record: true };
    }
    return { ok: true, status: 'pending', reason: 'new', record: true };
}

function resolveReferrerUid(code, users, codeIndex) {
    const normalized = normalizeCode(code);
    if (!normalized) return '';
    if (codeIndex && Object.prototype.hasOwnProperty.call(codeIndex, normalized)) {
        return codeIndex[normalized] || '';
    }
    const list = users || [];
    const byField = list.filter(function(user) {
        return user && user.referralCode === normalized;
    });
    if (byField.length === 1) return byField[0].uid;
    if (byField.length > 1) return '';
    const byPrefix = list.filter(function(user) {
        return user && String(user.uid || '').indexOf(normalized) === 0;
    });
    if (byPrefix.length === 1) return byPrefix[0].uid;
    return '';
}

function buildCodeIndex(users) {
    const index = {};
    (users || []).forEach(function(user) {
        if (!user || !user.uid) return;
        const code = user.referralCode || referralCodeForUid(user.uid);
        if (!code) return;
        if (!Object.prototype.hasOwnProperty.call(index, code)) index[code] = user.uid;
        else if (index[code] !== user.uid) index[code] = '';
    });
    return index;
}

function referredIdOf(referral) {
    if (!referral) return '';
    return referral.referredUserUid || referral.referredUid || referral.referredUser || referral.id || '';
}

const REGISTER_RATE_MS = 10 * 1000;
const REGISTER_RATE_HOUR_MS = 60 * 60 * 1000;
const REGISTER_RATE_HOUR_MAX = 8;

function registerRateDecision(prev, nowMs) {
    const src = prev || {};
    const now = Number(nowMs) || 0;
    const last = Number(src.lastMs) || 0;
    const windowStart = Number(src.windowStart) || 0;
    const count = Number(src.count) || 0;
    if (last && now - last < REGISTER_RATE_MS) return { ok: false, reason: 'rate' };
    const sameHour = windowStart && now - windowStart < REGISTER_RATE_HOUR_MS;
    if (sameHour && count >= REGISTER_RATE_HOUR_MAX) return { ok: false, reason: 'rate-hour' };
    return {
        ok: true,
        reason: 'ok',
        lastMs: now,
        windowStart: sameHour ? windowStart : now,
        count: sameHour ? count + 1 : 1,
    };
}

// Users whose alphanumeric code has no referralCodes/{code} doc.
// Lightning uids get a minted code. Dry-run callers print counts only.
function planCodeLookup(users, existingIndex) {
    const index = Object.assign({}, existingIndex || {});
    const writes = [];
    let collisions = 0;
    (users || []).forEach(function (user) {
        if (!user || !user.uid) return;
        let code = normalizeCode(user.referralCode);
        if (!code && !needsMintedReferralCode(user.uid)) code = referralCodeForUid(user.uid);
        if (!code && needsMintedReferralCode(user.uid)) {
            let salt = 0;
            let candidate = '';
            while (salt < 8) {
                candidate = mintedReferralCode(user.uid, salt);
                const owner = index[candidate];
                if (!owner || owner === user.uid) break;
                salt++;
                candidate = '';
            }
            code = candidate;
        }
        if (!code) return;
        const owner = Object.prototype.hasOwnProperty.call(index, code) ? index[code] : '';
        if (owner === user.uid) return;
        if (owner && owner !== user.uid) {
            collisions++;
            return;
        }
        writes.push({ uid: user.uid, code: code });
        index[code] = user.uid;
    });
    return {
        writes: writes,
        counts: {
            missing: writes.length,
            collisions: collisions,
        },
    };
}

function planBackfill(input) {
    const src = input || {};
    const users = src.users || [];
    const referrals = src.referrals || [];
    const byUid = {};
    users.forEach(function(user) {
        if (user && user.uid) byUid[user.uid] = user;
    });
    const referralByReferred = {};
    referrals.forEach(function(referral) {
        const id = referredIdOf(referral);
        if (id) referralByReferred[id] = referral;
    });
    const signalSet = {};
    (src.signals || []).forEach(function(id) { if (id) signalSet[id] = true; });
    const codeIndex = buildCodeIndex(users);

    const codesToWrite = [];
    users.forEach(function(user) {
        if (!user || !user.uid) return;
        const code = referralCodeForUid(user.uid);
        if (code && user.referralCode !== code) codesToWrite.push({ uid: user.uid, code: code });
    });

    const recordsToCreate = [];
    users.forEach(function(user) {
        if (!user || !user.uid) return;
        const code = normalizeCode(user.referredBy);
        if (!code) return;
        if (referralByReferred[user.uid]) return;
        if (isSelfReferral(user.uid, code)) return;
        const referrerUid = resolveReferrerUid(code, users, codeIndex);
        if (referrerUid && referrerUid === user.uid) return;
        const referrer = referrerUid ? byUid[referrerUid] : null;
        const flags = referrer
            ? fraudFlags(Object.assign({ uid: user.uid }, user), Object.assign({ uid: referrerUid }, referrer), '')
            : [];
        // referredBy used to be client-writable, so a doc built only from it
        // is untrusted and is never paid.
        recordsToCreate.push({
            referredUid: user.uid,
            referrerUid: referrerUid || '',
            referrerCode: code,
            status: 'untrusted',
            flags: flags,
            source: 'referredBy',
        });
    });

    const payouts = [];
    referrals.forEach(function(referral) {
        const id = referredIdOf(referral);
        if (!id) return;
        const row = Object.assign({}, referral, { referredUid: id });
        if (alreadyPaid(row)) return;
        if (row.status === 'flagged' || row.status === 'rejected' || row.status === 'late' || row.status === 'untrusted' || row.status === 'legacy') return;
        if (!signalSet[id] && !row.hasSignal) return;
        const referred = byUid[row.referredUid];
        if (!referred) return;
        let referrerUid = row.referrerUid || '';
        if (!referrerUid && row.referrerCode) {
            referrerUid = resolveReferrerUid(row.referrerCode, users, codeIndex);
        }
        if (!referrerUid || referrerUid === row.referredUid) return;
        referral = row;
        const referrer = byUid[referrerUid];
        if (!referrer) return;
        const decision = assessReferralPayout({
            hasSignal: true,
            nowMs: src.nowMs || 0,
            recentPaidAt: referrer.recentPaidAt || [],
            referral: referral,
            referred: Object.assign({ uid: referral.referredUid }, referred),
            referrer: Object.assign({ uid: referrerUid }, referrer),
        });
        if (decision.action === 'pay') {
            payouts.push({
                referredUid: referral.referredUid,
                referrerUid: referrerUid,
                tickets: REFERRAL_TICKETS,
            });
        }
    });

    return {
        codesToWrite: codesToWrite,
        recordsToCreate: recordsToCreate,
        payouts: payouts,
        counts: {
            referralCodesToBackfill: codesToWrite.length,
            referralRecordsToCreate: recordsToCreate.length,
            maxiPayouts: payouts.length,
            ticketGrants: payouts.length * 2,
            notifications: payouts.length * 2,
        },
    };
}

module.exports = {
    MAXI_POINTS: MAXI_POINTS,
    REFERRAL_TICKETS: REFERRAL_TICKETS,
    SIGNUP_WINDOW_MS: SIGNUP_WINDOW_MS,
    SIGNUP_MAX_POINTS: SIGNUP_MAX_POINTS,
    REFERRAL_LINK_TTL_MS: REFERRAL_LINK_TTL_MS,
    CODE_LENGTH: CODE_LENGTH,
    PAYOUT_MIN_AGE_MS: PAYOUT_MIN_AGE_MS,
    MIN_ACTIVE_DAYS: MIN_ACTIVE_DAYS,
    REFERRAL_PAY_CAP: REFERRAL_PAY_CAP,
    REFERRAL_PAY_WINDOW_MS: REFERRAL_PAY_WINDOW_MS,
    SIGNAL_TTL_MS: SIGNAL_TTL_MS,
    REGISTER_RATE_MS: REGISTER_RATE_MS,
    activityPoints: activityPoints,
    registerRateDecision: registerRateDecision,
    touchActiveDays: touchActiveDays,
    emailOk: emailOk,
    countRecentPays: countRecentPays,
    BLOCKING_FLAGS: BLOCKING_FLAGS,
    referralCodeForUid: referralCodeForUid,
    needsMintedReferralCode: needsMintedReferralCode,
    mintedReferralCode: mintedReferralCode,
    normalizeGuestUid: normalizeGuestUid,
    referralWindowStart: referralWindowStart,
    fairUpgradeWindow: fairUpgradeWindow,
    planCodeLookup: planCodeLookup,
    normalizeCode: normalizeCode,
    isSelfReferral: isSelfReferral,
    crossedMaxi: crossedMaxi,
    alreadyPaid: alreadyPaid,
    registrationGate: registrationGate,
    fraudFlags: fraudFlags,
    emailHashesOverlap: emailHashesOverlap,
    statusForFlags: statusForFlags,
    assessReferralPayout: assessReferralPayout,
    resolveReferrerUid: resolveReferrerUid,
    buildCodeIndex: buildCodeIndex,
    referredIdOf: referredIdOf,
    planBackfill: planBackfill,
};
