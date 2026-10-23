'use strict';

// Pure faucet rules. No Firebase. claimSats and the daily report both use these
// so the enforcement decisions can be tested without a wallet or Firestore.
// Payment lookup reuses cipherClaim.js (same paid / failed / hold outcomes).

const cipher = require('./cipherClaim');

const MAX_PER_CLAIM_SATS = 200;
const MAX_DAILY_PER_USER_SATS = 200;
const MIN_WITHDRAWAL_SATS = 100;
const SUBNET_WINDOW_MS = 24 * 60 * 60 * 1000;
const ADDRESS_WINDOW_MS = 24 * 60 * 60 * 1000;
const NETWORK_ACCOUNT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const REPORT_WINDOW_MS = 48 * 60 * 60 * 1000;
const SUPPORT_EMAIL = 'info.603btc@gmail.com';
const LN_LOCK_COPY = 'You can only add one lightning address to your account, and it can\'t be changed later. If you ever need to change it, email support at ' + SUPPORT_EMAIL + '.';
const SATS_DISABLED_ERROR = 'Sats withdrawals are disabled on this account. Contact support if you believe this is an error.';

function supportError(lead) {
    return lead + ' Email support at ' + SUPPORT_EMAIL + '.';
}

function normalizeLightningAddress(raw) {
    return String(raw == null ? '' : raw).trim().toLowerCase();
}

function validLightningAddress(addr) {
    if (!addr || typeof addr !== 'string') return false;
    if (addr.length < 5 || addr.length > 320) return false;
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr);
}

// Invoice claims are gone. A pasted bolt11 is ignored; the address is required.
function requireLightningAddress(data) {
    const src = data || {};
    const address = normalizeLightningAddress(src.lightningAddress);
    if (!address) {
        return {
            ok: false,
            error: 'A Lightning Address is required. Invoice paste is not accepted.',
        };
    }
    if (!validLightningAddress(address)) {
        return { ok: false, error: 'Invalid Lightning Address format.' };
    }
    return { ok: true, address: address, ignoredInvoice: !!String(src.invoice || '').trim() };
}

function assessClaimAmount(amount) {
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n < MIN_WITHDRAWAL_SATS || n > MAX_PER_CLAIM_SATS) {
        return {
            ok: false,
            error: 'Amount must be between ' + MIN_WITHDRAWAL_SATS + ' and ' + MAX_PER_CLAIM_SATS + ' sats.',
        };
    }
    return { ok: true, amount: n };
}

function publicDisplayName(user) {
    const d = user || {};
    const raw = String(d.username || d.displayName || '').trim();
    // Usernames are not emails. Drop anything that looks like one.
    if (!raw || raw.indexOf('@') !== -1) return 'Bitcoiner';
    return raw.substring(0, 40);
}

function assessBan(user, ledger) {
    const u = user || {};
    const l = ledger || {};
    if (u.satsDisabled === true || l.banned === true) {
        return { ok: false, error: SATS_DISABLED_ERROR };
    }
    return { ok: true };
}

// saved: address already on the account (any of the legacy field names), normalized by caller.
// lockOwner: uid on lightning_addresses/{address}, or ''.
// otherBanned: some other account already uses this address and is banned.
// otherInUse: some other account already has this address saved. A reset must not
// create the lock out from under them. A normal claim leaves this false so the
// first real withdrawal can still take an unlocked address.
function assessAddressLock(info) {
    const src = info || {};
    const callerUid = String(src.callerUid || '');
    const requested = normalizeLightningAddress(src.requested);
    const saved = normalizeLightningAddress(src.saved);
    const lockOwner = String(src.lockOwner || '');
    if (!validLightningAddress(requested)) {
        return { ok: false, error: 'Invalid Lightning Address format.' };
    }
    if (saved && requested !== saved) {
        return {
            ok: false,
            code: 'address_changed',
            error: 'Your Lightning Address is locked to this account and can\'t be changed. ' + LN_LOCK_COPY,
        };
    }
    if (lockOwner && lockOwner !== callerUid) {
        return {
            ok: false,
            code: 'address_conflict',
            flag: true,
            error: supportError('This Lightning Address is locked to another account.'),
        };
    }
    if (src.lockOwnerBanned === true || src.otherBanned === true) {
        return {
            ok: false,
            code: 'address_banned',
            flag: true,
            error: supportError('This Lightning Address is linked to a disabled account.'),
        };
    }
    if (src.otherInUse === true) {
        return {
            ok: false,
            code: 'address_conflict',
            flag: true,
            error: supportError('This Lightning Address is already on another account.'),
        };
    }
    return { ok: true, address: requested, createLock: !lockOwner };
}

function assessFingerprint(uids, uid) {
    const list = Array.isArray(uids) ? uids : [];
    const others = [];
    for (let i = 0; i < list.length; i++) {
        const id = list[i];
        if (id && id !== uid && others.indexOf(id) === -1) others.push(id);
    }
    if (others.length > 0) {
        return {
            ok: false,
            code: 'fingerprint',
            log: 'FINGERPRINT ABUSE',
            others: others,
            error: supportError('This device is already linked to another account.'),
        };
    }
    return { ok: true, others: [] };
}

function fingerprintDocId(fp) {
    const clean = String(fp || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 64);
    return clean.length >= 8 ? clean : '';
}

function addressRateDocId(addr) {
    return normalizeLightningAddress(addr).replace(/[^a-z0-9@._-]/g, '_').substring(0, 80);
}

function pruneAddressClaims(claims, now, windowMs) {
    const list = Array.isArray(claims) ? claims : [];
    const cutoff = (Number(now) || 0) - (windowMs == null ? ADDRESS_WINDOW_MS : windowMs);
    const kept = [];
    for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (!c || typeof c !== 'object') continue;
        const ts = Number(c.ts) || 0;
        if (ts > cutoff) {
            kept.push({
                uid: String(c.uid || ''),
                ts: ts,
                amount: Math.floor(Number(c.amount) || 0),
            });
        }
    }
    return kept;
}

function assessAddressRate(claims, now) {
    const recent = pruneAddressClaims(claims, now);
    if (recent.length >= 2) {
        const oldest = recent.slice().sort(function(a, b) { return a.ts - b.ts; })[0];
        const hoursLeft = Math.max(1, Math.ceil((oldest.ts + ADDRESS_WINDOW_MS - now) / 3600000));
        return {
            ok: false,
            recent: recent,
            error: 'Too many withdrawals to this Lightning Address in the last 24 hours. Try again in ~' + hoursLeft + ' hour(s).',
        };
    }
    return { ok: true, recent: recent };
}

// Rightmost X-Forwarded-For entry is the one Google appends. The leftmost
// entry is whatever the caller sent, so context.rawRequest.ip is not used.
function clientIpFromRequest(req) {
    const src = req || {};
    const headers = src.headers || {};
    let forwarded = headers['x-forwarded-for'];
    if (Array.isArray(forwarded)) forwarded = forwarded.join(',');
    const parts = String(forwarded || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    let ip = parts.length ? parts[parts.length - 1] : '';
    if (!ip) {
        const sock = src.socket || src.connection || {};
        ip = String(sock.remoteAddress || '').trim();
    }
    ip = ip.replace(/^::ffff:/i, '');
    return ip;
}

// seen is { uid: millis }. Entries older than 30 days do not count.
// A bare uids array from older docs has no time, so it does not count.
function accountsSeenRecently(slot, now) {
    const src = slot || {};
    const seen = src.seen && typeof src.seen === 'object' && !Array.isArray(src.seen) ? src.seen : {};
    const fresh = {};
    const atNow = Number(now) || 0;
    Object.keys(seen).forEach(function(id) {
        const at = Number(seen[id]) || 0;
        if (!id || !at) return;
        const age = atNow - at;
        if (age <= NETWORK_ACCOUNT_WINDOW_MS && age >= -60000) fresh[id] = at;
    });
    return fresh;
}

function _crossAccount24h(slot, uid, now) {
    const src = slot || {};
    const lastUid = src.lastUid || '';
    const lastMs = Number(src.lastClaimMs) || 0;
    const age = Number(now) - lastMs;
    if (lastUid && lastUid !== uid && lastMs && age >= 0 && age < SUBNET_WINDOW_MS) {
        return {
            ok: false,
            code: 'network_24h',
            error: supportError('A claim was already made from this network in the last 24 hours.'),
        };
    }
    return null;
}

// Exact IP: a third distinct account in the last 30 days is blocked, and a
// different account cannot claim again within 24 hours.
function assessExactIpSlot(slot, uid, now) {
    const seen = accountsSeenRecently(slot, now);
    const ids = Object.keys(seen);
    if (ids.indexOf(uid) === -1 && ids.length >= 2) {
        return {
            ok: false,
            code: 'network_hard',
            error: supportError('This network is already linked to other accounts.'),
        };
    }
    const day = _crossAccount24h(slot, uid, now);
    if (day) return day;
    seen[uid] = Number(now);
    return { ok: true, seen: seen };
}

// Subnet (/24 or /64): one cross-account claim per 24 hours. The account list
// is kept for 30 days and is not a permanent hard block.
function assessSubnetSlot(slot, uid, now) {
    const seen = accountsSeenRecently(slot, now);
    const day = _crossAccount24h(slot, uid, now);
    if (day) return day;
    seen[uid] = Number(now);
    return { ok: true, seen: seen };
}

function _docId(parts) {
    return parts.join('_').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 200);
}

function _ipv4Parts(ip) {
    const m = String(ip || '').match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return null;
    const tokens = [m[1], m[2], m[3], m[4]];
    const nums = tokens.map(function(p) { return Number(p); });
    if (nums.some(function(n, i) { return n > 255 || String(n) !== tokens[i]; })) return null;
    return nums;
}

function _expandIPv6(ip) {
    let s = String(ip || '').trim().toLowerCase();
    if (!s || s.indexOf(':') === -1) return null;
    if (s.indexOf('.') !== -1) {
        const lastColon = s.lastIndexOf(':');
        const v4 = _ipv4Parts(s.slice(lastColon + 1));
        if (!v4) return null;
        const hi = ((v4[0] << 8) | v4[1]).toString(16);
        const lo = ((v4[2] << 8) | v4[3]).toString(16);
        s = s.slice(0, lastColon + 1) + hi + ':' + lo;
    }
    const halves = s.split('::');
    if (halves.length > 2) return null;
    let groups;
    if (halves.length === 2) {
        const left = halves[0] ? halves[0].split(':') : [];
        const right = halves[1] ? halves[1].split(':') : [];
        if (left.concat(right).some(function(g) { return g === ''; })) return null;
        const missing = 8 - left.length - right.length;
        if (missing < 1) return null;
        groups = left.concat(new Array(missing).fill('0')).concat(right);
    } else {
        groups = s.split(':');
    }
    if (groups.length !== 8) return null;
    const norm = [];
    for (let i = 0; i < groups.length; i++) {
        if (!/^[0-9a-f]{1,4}$/.test(groups[i])) return null;
        norm.push(('0000' + groups[i]).slice(-4));
    }
    return norm;
}

function _fromMapped(groups) {
    if (!groups) return null;
    for (let i = 0; i < 5; i++) if (groups[i] !== '0000') return null;
    if (groups[5] !== 'ffff') return null;
    const hi = parseInt(groups[6], 16);
    const lo = parseInt(groups[7], 16);
    return [(hi >> 8) & 255, hi & 255, (lo >> 8) & 255, lo & 255];
}

// Key claims on the exact IP and on the /24 (v4) or /64 (v6).
// IPv4 exact ids stay compatible with the previous faucet_ip_log docs (1_2_3_4).
function networkKeys(ip) {
    const raw = String(ip || '').trim();
    if (!raw || raw.toLowerCase() === 'unknown') return null;
    const v4 = _ipv4Parts(raw);
    if (v4) {
        return {
            version: 4,
            exactId: v4.join('_'),
            rangeId: _docId([v4[0], v4[1], v4[2], '0', '24']),
            rangeLabel: v4[0] + '.' + v4[1] + '.' + v4[2] + '.0/24',
        };
    }
    const groups = _expandIPv6(raw);
    if (!groups) return null;
    const mapped = _fromMapped(groups);
    if (mapped) return networkKeys(mapped.join('.'));
    return {
        version: 6,
        exactId: _docId(groups),
        rangeId: _docId(groups.slice(0, 4).concat(['64'])),
        rangeLabel: groups.slice(0, 4).map(function(g) { return g.replace(/^0+/, '') || '0'; }).join(':') + '::/64',
    };
}

function decideFaucetPayment(info) {
    const src = info || {};
    const action = cipher.payErrorAction({
        phase: src.phase,
        error: src.error,
        payResult: src.payResult,
    });
    if (action === 'paid') {
        return { action: 'record', preimage: (src.payResult && src.payResult.preimage) || '' };
    }
    if (action === 'release') {
        return { action: 'refund', reason: src.phase === 'pay' ? 'refused' : 'balance' };
    }
    return { action: 'lookup' };
}

function decideFaucetLookupResult(settlement) {
    const d = settlement || {};
    if (d.action === 'paid') return { action: 'record', preimage: d.preimage || '' };
    if (d.action === 'release') return { action: 'refund', reason: 'lookup_failed' };
    return { action: 'unknown' };
}

function _account(row) {
    return {
        uid: String((row && row.uid) || ''),
        displayName: publicDisplayName(row),
        banned: !!(row && (row.banned === true || row.ledgerBanned === true)),
        satsDisabled: !!(row && row.satsDisabled === true),
    };
}

function _pushAccount(list, row) {
    const acc = _account(row);
    if (!acc.uid) return;
    if (!list.some(function(a) { return a.uid === acc.uid; })) list.push(acc);
}

function _cluster(kind, key, rows) {
    const accounts = [];
    rows.forEach(function(row) { _pushAccount(accounts, row); });
    if (accounts.length < 2) return null;
    const bannedLink = accounts.some(function(a) { return a.banned || a.satsDisabled; });
    // A pair of clean accounts still matters. A single account does not.
    // Two accounts, or any share with a banned account (which implies 2+).
    if (accounts.length < 2) return null;
    return {
        kind: kind,
        key: String(key),
        bannedLink: bannedLink,
        accounts: accounts,
    };
}

// Groups in-window signups and claims that share a fingerprint, subnet, or
// Lightning address with another account or with a banned account.
// Unknown payments and locked-address conflicts are listed separately.
// Account emails are never copied onto the report.
function buildAbuseReport(input) {
    const src = input || {};
    const now = Number(src.now) || Date.now();
    const windowMs = src.windowMs == null ? REPORT_WINDOW_MS : src.windowMs;
    const start = now - windowMs;
    function inWindow(row) {
        const at = Number(row && row.at) || 0;
        return at >= start && at <= now + 1000;
    }
    const claims = (Array.isArray(src.claims) ? src.claims : []).filter(inWindow);
    const signups = (Array.isArray(src.signups) ? src.signups : []).filter(inWindow);
    const banned = Array.isArray(src.bannedAccounts) ? src.bannedAccounts : [];
    const pool = claims.concat(signups).concat(banned.map(function(b) {
        return Object.assign({}, b, { banned: true });
    }));

    function groupsOf(keyName, rows) {
        const map = {};
        rows.forEach(function(row) {
            const key = row && row[keyName] ? String(row[keyName]) : '';
            if (!key) return;
            // Only open a cluster from an in-window signup or claim,
            // then attach every account that shares the key (including banned).
            if (!inWindow(row) && row.banned !== true && row.satsDisabled !== true) return;
            (map[key] = map[key] || []).push(row);
        });
        const out = [];
        Object.keys(map).forEach(function(key) {
            const seed = map[key].some(function(row) { return inWindow(row); });
            if (!seed) return;
            const everyone = pool.filter(function(row) { return String(row[keyName] || '') === key; });
            const cluster = _cluster(keyName === 'lightningAddress' ? 'lightning' : keyName, key, everyone);
            if (cluster) out.push(cluster);
        });
        return out;
    }

    const clusters = []
        .concat(groupsOf('fingerprint', claims))
        .concat(groupsOf('subnet', claims))
        .concat(groupsOf('lightningAddress', claims.concat(signups)));

    const unknownPayments = (Array.isArray(src.unknownPayments) ? src.unknownPayments : [])
        .filter(inWindow)
        .map(function(row) {
            return {
                uid: String(row.uid || ''),
                displayName: publicDisplayName(row),
                amount: Math.floor(Number(row.amount) || 0),
                paymentHash: String(row.paymentHash || '').substring(0, 80),
                at: Number(row.at) || 0,
            };
        })
        .filter(function(row) { return row.uid; });

    const addressConflicts = (Array.isArray(src.addressConflicts) ? src.addressConflicts : [])
        .filter(inWindow)
        .map(function(row) {
            return {
                uid: String(row.uid || ''),
                displayName: publicDisplayName(row),
                otherUid: String(row.otherUid || ''),
                otherDisplayName: publicDisplayName({ username: row.otherDisplayName }),
                address: normalizeLightningAddress(row.address),
                at: Number(row.at) || 0,
            };
        })
        .filter(function(row) { return row.uid && row.address; });

    return {
        generatedAtMs: now,
        windowStartMs: start,
        windowEndMs: now,
        counts: {
            clusters: clusters.length,
            unknownPayments: unknownPayments.length,
            addressConflicts: addressConflicts.length,
        },
        clusters: clusters,
        unknownPayments: unknownPayments,
        addressConflicts: addressConflicts,
    };
}

module.exports = {
    MAX_PER_CLAIM_SATS: MAX_PER_CLAIM_SATS,
    MAX_DAILY_PER_USER_SATS: MAX_DAILY_PER_USER_SATS,
    MIN_WITHDRAWAL_SATS: MIN_WITHDRAWAL_SATS,
    SUBNET_WINDOW_MS: SUBNET_WINDOW_MS,
    NETWORK_ACCOUNT_WINDOW_MS: NETWORK_ACCOUNT_WINDOW_MS,
    ADDRESS_WINDOW_MS: ADDRESS_WINDOW_MS,
    REPORT_WINDOW_MS: REPORT_WINDOW_MS,
    SUPPORT_EMAIL: SUPPORT_EMAIL,
    LN_LOCK_COPY: LN_LOCK_COPY,
    SATS_DISABLED_ERROR: SATS_DISABLED_ERROR,
    supportError: supportError,
    normalizeLightningAddress: normalizeLightningAddress,
    validLightningAddress: validLightningAddress,
    requireLightningAddress: requireLightningAddress,
    assessClaimAmount: assessClaimAmount,
    publicDisplayName: publicDisplayName,
    assessBan: assessBan,
    assessAddressLock: assessAddressLock,
    assessFingerprint: assessFingerprint,
    fingerprintDocId: fingerprintDocId,
    addressRateDocId: addressRateDocId,
    pruneAddressClaims: pruneAddressClaims,
    assessAddressRate: assessAddressRate,
    clientIpFromRequest: clientIpFromRequest,
    accountsSeenRecently: accountsSeenRecently,
    assessExactIpSlot: assessExactIpSlot,
    assessSubnetSlot: assessSubnetSlot,
    networkKeys: networkKeys,
    decideFaucetPayment: decideFaucetPayment,
    decideFaucetLookupResult: decideFaucetLookupResult,
    lookupSettlement: cipher.lookupSettlement,
    lookupRequestFromDecoded: cipher.lookupRequestFromDecoded,
    buildAbuseReport: buildAbuseReport,
};
