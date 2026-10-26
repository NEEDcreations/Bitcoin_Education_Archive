'use strict';

// Pure referral decisions. Firestore I/O lives in referralService.js.
// Nobody has been paid yet: the award is 50 orange tickets to each side,
// exactly once, when the referee reaches Maxi (2,140 points).

const MAXI_POINTS = 2140;
const REFERRAL_TICKETS = 50;
const CODE_LENGTH = 8;

const SIGNUP_WINDOW_MS = 72 * 60 * 60 * 1000;
const SIGNUP_MAX_POINTS = 100;
const PAYOUT_MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_ACTIVE_DAYS = 3;
const REFERRAL_PAY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const CONNECTION_HOLD_MS = 30 * 24 * 60 * 60 * 1000;
const CONNECTION_RECHECK_MS = 24 * 60 * 60 * 1000;
const REFERRAL_PAY_CAP = 5;
const SIGNAL_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const EMAIL_PROVIDERS = { password: 1, 'google.com': 1, 'apple.com': 1, 'facebook.com': 1 };

const BLOCKING_FLAGS = {
    'self': 'rejected',
    'sats-disabled': 'rejected',
    'banned': 'rejected',
    'ledger-banned': 'rejected',
    'same-fingerprint': 'flagged',
    'ipqs-deny': 'rejected',
    'ipqs-hold': 'flagged',
    'device-deny': 'rejected',
    'device-hold': 'flagged',
    'same-ip': 'flagged',
    'same-email': 'flagged',
    'same-lightning': 'flagged',
    'circular': 'flagged',
    'linked-account': 'flagged',
    'prior-referral': 'rejected',
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
    if (referred.banned === true || referrer.banned === true) flags.push('banned');
    if (referred.ledgerBanned === true || referrer.ledgerBanned === true) flags.push('ledger-banned');
    const fpA = String(referred.fingerprint || '').trim();
    const fpB = String(referrer.fingerprint || '').trim();
    const devA = String(referred.deviceHmac || '').trim().toLowerCase();
    const devB = String(referrer.deviceHmac || '').trim().toLowerCase();
    if ((fpA && fpB && fpA === fpB) || (devA && devB && devA === devB)) flags.push('same-fingerprint');
    if (referred.ipqsAction === 'deny') flags.push('ipqs-deny');
    // VPN, proxy, and Tor wait. Any other IP hold, such as the optional score band, still flags.
    if (referred.ipqsAction === 'hold' && !connectionHoldReason(referred.ipqsReason)) flags.push('ipqs-hold');
    if (referred.deviceAction === 'deny') flags.push('device-deny');
    if (referred.deviceAction === 'hold') flags.push('device-hold');
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
    const referredCode = referralCodeForUid(referred.uid);
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

function connectionHoldReason(reason) {
    const value = lower(reason);
    if (value === 'vpn' || value === 'proxy' || value === 'tor') return value;
    return '';
}

function waitingReason(reason) {
    if (connectionHoldReason(reason)) return connectionHoldReason(reason);
    return lower(reason) === 'budget' ? 'budget' : '';
}

function normalizeIpqsHold(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const reason = waitingReason(value.reason);
    const since = Number(value.since) || 0;
    if (!reason || !since) return null;
    let checkedAt = since;
    if (value.checkedAt === 0) checkedAt = 0;
    else if (Number(value.checkedAt) > 0) checkedAt = Number(value.checkedAt);
    return {
        reason: reason,
        since: since,
        checkedAt: checkedAt,
    };
}

function signalFlagList(signal) {
    const flags = signal && signal.flags;
    if (!Array.isArray(flags)) return [];
    return flags.map(function(flag) { return String(flag || ''); }).filter(Boolean);
}

// A pre-change doc flagged only for VPN, proxy, or Tor is waiting, not dead.
function isLegacyConnectionHold(referral, signal) {
    if (!referral || alreadyPaid(referral) || referral.status !== 'flagged') return false;
    const flags = signalFlagList(signal);
    const other = flags.filter(function(flag) { return flag !== 'ipqs-hold'; });
    if (other.length) return false;
    const marked = flags.indexOf('ipqs-hold') !== -1 || (signal && signal.ipqsAction === 'hold');
    if (!marked) return false;
    if (connectionHoldReason(signal && signal.ipqsReason)) return true;
    return !!(signal && (signal.ipqsVpn || signal.ipqsProxy || signal.ipqsTor));
}

function connectionHoldState(referral, signal) {
    const marked = normalizeIpqsHold(signal && signal.ipqsHold) || normalizeIpqsHold(referral && referral.ipqsHold);
    if (marked) return marked;
    const storedReason = connectionHoldReason(signal && signal.ipqsReason);
    if (signal && signal.ipqsAction === 'hold' && storedReason) {
        const checkedAt = Number(signal.ipqsCheckedAtMs) || 0;
        return { reason: storedReason, since: checkedAt, checkedAt: checkedAt };
    }
    const legacy = isLegacyConnectionHold(referral, signal);
    if (!referral || (referral.status !== 'held_connection' && !legacy)) return null;
    const reason = storedReason
        || (signal && signal.ipqsTor ? 'tor' : '')
        || (signal && signal.ipqsProxy ? 'proxy' : '')
        || (signal && signal.ipqsVpn ? 'vpn' : '')
        || 'vpn';
    const checkedAt = Number(signal && signal.ipqsCheckedAtMs) || 0;
    const since = Number(signal && signal.holdSince) || checkedAt;
    return { reason: reason, since: since, checkedAt: checkedAt || since };
}

function connectionRecheckDue(hold, nowMs) {
    if (!hold) return false;
    const checked = Number(hold.checkedAt) || 0;
    if (!checked) return true;
    return (Number(nowMs) || 0) - checked >= CONNECTION_RECHECK_MS;
}

function realServerVerdict(verdict) {
    if (!verdict || typeof verdict !== 'object') return null;
    const action = String(verdict.action || '');
    if (action !== 'allow' && action !== 'hold' && action !== 'deny') return null;
    return verdict;
}

// Client flags are ignored. Only a real server verdict can clear or refresh a hold.
function settleConnection(input) {
    const src = input || {};
    const now = Number(src.nowMs) || 0;
    const referral = src.referral || {};
    const signal = src.signal || {};
    const verdict = realServerVerdict(src.serverVerdict);
    const hold = connectionHoldState(referral, signal);
    const legacy = isLegacyConnectionHold(referral, signal);
    const watching = !!(hold && (referral.status === 'held_connection' || referral.status === 'pending' || referral.status === 'flagged' || legacy));
    if (verdict && verdict.action === 'deny') {
        return { effect: 'deny', reason: connectionHoldReason(verdict.reason) || String(verdict.reason || 'ipqs-deny') };
    }
    // A hold older than 30 days expires before a clean check can pay it.
    if (hold && hold.since && now - hold.since >= CONNECTION_HOLD_MS) {
        return { effect: 'expire', ipqsHold: hold };
    }
    if (verdict && verdict.action === 'allow') {
        if (!watching && !hold) return { effect: 'none' };
        return { effect: 'clear' };
    }
    if (verdict && verdict.action === 'hold' && connectionHoldReason(verdict.reason)) {
        const since = hold && hold.since ? hold.since : now;
        const next = { reason: connectionHoldReason(verdict.reason), since: since || now, checkedAt: now || since };
        if (next.since && now - next.since >= CONNECTION_HOLD_MS) return { effect: 'expire', ipqsHold: next };
        return { effect: 'hold', ipqsHold: next };
    }
    if (verdict && verdict.action === 'hold') {
        return { effect: 'flag-hold', reason: String(verdict.reason || 'ipqs-hold') };
    }
    if (!watching) return { effect: 'none' };
    if (hold && hold.since && now - hold.since >= CONNECTION_HOLD_MS) return { effect: 'expire', ipqsHold: hold };
    return { effect: 'hold', ipqsHold: hold };
}

function signupConnection(flags, verdict, nowMs, extra) {
    const status = statusForFlags(flags);
    const reason = connectionHoldReason(verdict && verdict.reason);
    const action = verdict && verdict.action;
    const now = Number(nowMs) || 0;
    if (status === 'pending' && action === 'hold' && reason) {
        return {
            status: 'held_connection',
            ipqsHold: { reason: reason, since: now, checkedAt: now },
        };
    }
    if (status === 'pending' && extra && extra.budgetWait) {
        return {
            status: 'held_connection',
            ipqsHold: { reason: 'budget', since: now, checkedAt: 0 },
        };
    }
    return { status: status, ipqsHold: null };
}

function payoutLookupIp(input) {
    const src = input || {};
    if (src.seen) return '';
    const requestIp = String(src.requestIp || '');
    if (src.recheckDue && requestIp) return requestIp;
    const open = !!(src.ready && !src.hold && !src.legacy);
    if (open && requestIp) return requestIp;
    if (open && !requestIp) return String(src.checkIp || '');
    return '';
}

function referralCheckIsFinal(referral, signal) {
    if (!referral) return false;
    if (alreadyPaid(referral)) return true;
    const status = String(referral.status || '');
    if (status === 'rejected' || status === 'expired' || status === 'late' || status === 'untrusted' || status === 'legacy') return true;
    if (status === 'flagged' && !isLegacyConnectionHold(referral, signal)) return true;
    return false;
}

function blocksUncheckedPay(requestIp, verdict) {
    if (!String(requestIp || '')) return false;
    return !realServerVerdict(verdict);
}

function assessReferralPayout(input) {
    const src = input || {};
    const referral = src.referral;
    const referred = src.referred;
    const referrer = src.referrer;
    if (!referral) return { action: 'skip', reason: 'no-referral' };
    if (alreadyPaid(referral)) return { action: 'skip', reason: 'already-paid' };
    const signal = src.signal || {};
    const legacyHold = isLegacyConnectionHold(referral, signal);
    if (referral.status === 'expired') return { action: 'skip', reason: 'expired' };
    if (referral.status === 'flagged' && !legacyHold) return { action: 'skip', reason: 'flagged' };
    if (referral.status === 'rejected' || referral.status === 'late' || referral.status === 'untrusted' || referral.status === 'legacy') {
        return { action: 'skip', reason: referral.status };
    }
    // Client-written docs have no server signal. They are never auto-paid.
    if (!src.hasSignal) return { action: 'legacy', reason: 'legacy' };
    if (!referred || !referrer || !referred.uid || !referrer.uid) return { action: 'skip', reason: 'missing-user' };
    if (referred.uid === referrer.uid) return { action: 'reject', reason: 'self', flags: ['self'] };
    const now = Number(src.nowMs) || 0;
    const settlement = settleConnection({
        nowMs: now,
        referral: referral,
        signal: signal,
        serverVerdict: src.serverVerdict,
    });
    if (settlement.effect === 'deny') {
        referred.ipqsAction = 'deny';
        referred.ipqsReason = settlement.reason;
    } else if (settlement.effect === 'flag-hold') {
        referred.ipqsAction = 'hold';
        referred.ipqsReason = settlement.reason;
    } else if (settlement.effect === 'clear') {
        referred.ipqsAction = 'allow';
        referred.ipqsReason = 'clean';
    } else if (settlement.effect === 'hold' && waitingReason((settlement.ipqsHold && settlement.ipqsHold.reason) || referred.ipqsReason)) {
        referred.ipqsAction = '';
    }
    const flags = fraudFlags(referred, referrer, src.signupIpHmac || src.signupIp || '');
    const blocking = flags.filter(function(flag) { return !!BLOCKING_FLAGS[flag]; });
    if (blocking.length) {
        const status = statusForFlags(blocking);
        return { action: status === 'rejected' ? 'reject' : 'flag', reason: blocking[0], flags: blocking, clearHold: true };
    }
    if (settlement.effect === 'expire') {
        return { action: 'expire', reason: 'connection-hold-expired', ipqsHold: settlement.ipqsHold, clearHold: true };
    }
    if (settlement.effect === 'hold') {
        const nextHold = settlement.ipqsHold || { reason: 'vpn', since: now, checkedAt: now };
        return { action: 'hold', reason: nextHold.reason || 'vpn', ipqsHold: nextHold, flags: [] };
    }
    const cleared = settlement.effect === 'clear';
    function waiting(reason) {
        if (cleared) return { action: 'clear', reason: reason, clearHold: true };
        return { action: 'skip', reason: reason };
    }
    if (activityPoints(referred) < MAXI_POINTS) return waiting('below-maxi');
    const created = referred.createdMs == null ? null : Number(referred.createdMs);
    if (created == null || !isFinite(created)) return waiting('age-unknown');
    if (now - created < PAYOUT_MIN_AGE_MS) return waiting('too-new');
    const days = {};
    (Array.isArray(referred.activeDayKeys) ? referred.activeDayKeys : []).forEach(function(day) {
        if (day) days[day] = 1;
    });
    if (Object.keys(days).length < MIN_ACTIVE_DAYS) return waiting('inactive');
    if (!emailOk(referred)) return waiting('email-unverified');
    if (countRecentPays(src.recentPaidAt, now) >= REFERRAL_PAY_CAP) {
        return { action: 'flag', reason: 'referral-cap', flags: ['referral-cap'], clearHold: cleared };
    }
    return {
        action: 'pay',
        reason: 'maxi',
        ticketsEach: REFERRAL_TICKETS,
        referredUid: referred.uid,
        referrerUid: referrer.uid,
        clearHold: cleared,
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
    if (points > SIGNUP_MAX_POINTS) {
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
        if (row.status === 'flagged' || row.status === 'rejected' || row.status === 'late' || row.status === 'untrusted' || row.status === 'legacy' || row.status === 'expired') return;
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
    PAYOUT_MIN_AGE_MS: PAYOUT_MIN_AGE_MS,
    MIN_ACTIVE_DAYS: MIN_ACTIVE_DAYS,
    REFERRAL_PAY_CAP: REFERRAL_PAY_CAP,
    REFERRAL_PAY_WINDOW_MS: REFERRAL_PAY_WINDOW_MS,
    CONNECTION_HOLD_MS: CONNECTION_HOLD_MS,
    CONNECTION_RECHECK_MS: CONNECTION_RECHECK_MS,
    SIGNAL_TTL_MS: SIGNAL_TTL_MS,
    REGISTER_RATE_MS: REGISTER_RATE_MS,
    activityPoints: activityPoints,
    registerRateDecision: registerRateDecision,
    touchActiveDays: touchActiveDays,
    emailOk: emailOk,
    countRecentPays: countRecentPays,
    BLOCKING_FLAGS: BLOCKING_FLAGS,
    referralCodeForUid: referralCodeForUid,
    normalizeCode: normalizeCode,
    isSelfReferral: isSelfReferral,
    crossedMaxi: crossedMaxi,
    alreadyPaid: alreadyPaid,
    registrationGate: registrationGate,
    fraudFlags: fraudFlags,
    emailHashesOverlap: emailHashesOverlap,
    statusForFlags: statusForFlags,
    connectionHoldReason: connectionHoldReason,
    isLegacyConnectionHold: isLegacyConnectionHold,
    connectionHoldState: connectionHoldState,
    connectionRecheckDue: connectionRecheckDue,
    settleConnection: settleConnection,
    signupConnection: signupConnection,
    payoutLookupIp: payoutLookupIp,
    referralCheckIsFinal: referralCheckIsFinal,
    blocksUncheckedPay: blocksUncheckedPay,
    assessReferralPayout: assessReferralPayout,
    resolveReferrerUid: resolveReferrerUid,
    buildCodeIndex: buildCodeIndex,
    referredIdOf: referredIdOf,
    planBackfill: planBackfill,
};
