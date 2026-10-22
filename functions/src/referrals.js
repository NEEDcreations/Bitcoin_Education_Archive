'use strict';

// Pure referral decisions. Firestore I/O lives in referralService.js.
// Nobody has been paid yet: the award is 50 orange tickets to each side,
// exactly once, when the referee reaches Maxi (2,140 points).

const MAXI_POINTS = 2140;
const REFERRAL_TICKETS = 50;
const CODE_LENGTH = 8;

const BLOCKING_FLAGS = {
    'self': 'rejected',
    'sats-disabled': 'rejected',
    'same-fingerprint': 'flagged',
    'same-ip': 'flagged',
    'same-email': 'flagged',
    'same-lightning': 'flagged',
    'circular': 'flagged',
};

function referralCodeForUid(uid) {
    const id = String(uid || '');
    return id.length >= CODE_LENGTH ? id.substring(0, CODE_LENGTH) : '';
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
    const lnA = lightningOf(referred);
    const lnB = lightningOf(referrer);
    if (lnA && lnB && lnA === lnB) flags.push('same-lightning');
    const referredCode = referralCodeForUid(referred.uid);
    if (referredCode && lower(referrer.referredBy) === lower(referredCode)) flags.push('circular');
    return flags;
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

function assessReferralPayout(input) {
    const src = input || {};
    const referral = src.referral;
    const referred = src.referred;
    const referrer = src.referrer;
    if (!referral) return { action: 'skip', reason: 'no-referral' };
    if (alreadyPaid(referral)) return { action: 'skip', reason: 'already-paid' };
    if (referral.status === 'flagged') return { action: 'skip', reason: 'flagged' };
    if (referral.status === 'rejected') return { action: 'skip', reason: 'rejected' };
    if (!referred || !referrer || !referred.uid || !referrer.uid) return { action: 'skip', reason: 'missing-user' };
    if (referred.uid === referrer.uid) return { action: 'reject', reason: 'self', flags: ['self'] };
    if ((Number(referred.points) || 0) < MAXI_POINTS) return { action: 'skip', reason: 'below-maxi' };
    const flags = fraudFlags(referred, referrer, src.signupIp);
    const blocking = flags.filter(function(flag) { return !!BLOCKING_FLAGS[flag]; });
    if (blocking.length) {
        const status = statusForFlags(blocking);
        return { action: status === 'rejected' ? 'reject' : 'flag', reason: blocking[0], flags: blocking };
    }
    return {
        action: 'pay',
        reason: 'maxi',
        ticketsEach: REFERRAL_TICKETS,
        referredUid: referred.uid,
        referrerUid: referrer.uid,
    };
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
        const status = referrer ? statusForFlags(flags) : 'pending';
        recordsToCreate.push({
            referredUid: user.uid,
            referrerUid: referrerUid || '',
            referrerCode: code,
            status: status,
            flags: flags,
        });
    });

    const combined = [];
    referrals.forEach(function(referral) {
        const id = referredIdOf(referral);
        if (!id) return;
        combined.push(Object.assign({}, referral, { referredUid: id }));
    });
    recordsToCreate.forEach(function(record) {
        combined.push({
            referredUid: record.referredUid,
            referrerUid: record.referrerUid,
            referrerCode: record.referrerCode,
            status: record.status,
            flags: record.flags,
            ticketsAwarded: false,
        });
    });

    const payouts = [];
    combined.forEach(function(referral) {
        if (alreadyPaid(referral)) return;
        if (referral.status === 'flagged' || referral.status === 'rejected') return;
        const referred = byUid[referral.referredUid];
        if (!referred) return;
        let referrerUid = referral.referrerUid || '';
        if (!referrerUid && referral.referrerCode) {
            referrerUid = resolveReferrerUid(referral.referrerCode, users, codeIndex);
        }
        if (!referrerUid) {
            const code = normalizeCode(referred.referredBy);
            if (code) referrerUid = resolveReferrerUid(code, users, codeIndex);
        }
        if (!referrerUid || referrerUid === referral.referredUid) return;
        const referrer = byUid[referrerUid];
        if (!referrer) return;
        const decision = assessReferralPayout({
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
    BLOCKING_FLAGS: BLOCKING_FLAGS,
    referralCodeForUid: referralCodeForUid,
    normalizeCode: normalizeCode,
    isSelfReferral: isSelfReferral,
    crossedMaxi: crossedMaxi,
    alreadyPaid: alreadyPaid,
    fraudFlags: fraudFlags,
    statusForFlags: statusForFlags,
    assessReferralPayout: assessReferralPayout,
    resolveReferrerUid: resolveReferrerUid,
    buildCodeIndex: buildCodeIndex,
    referredIdOf: referredIdOf,
    planBackfill: planBackfill,
};
