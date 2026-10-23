'use strict';

// Badge and Favor credit for a tip. Social confirmation can still record a day.
// Credit requires a server-fetched invoice, an allowlisted verify host, distinct
// unbanned users, no shared fingerprint or IP cluster when that data exists,
// and one credit per sender/recipient/UTC day.

const { rewardBlocked } = require('./cipherClaim');
const { safeVerifyUrl } = require('./tipConfirm');

const VERIFY_HOSTS = [
    'walletofsatoshi.com',
    'strike.me',
    'getalby.com',
    'blink.sv',
    'zebedee.io',
    'zbd.gg',
    'primal.net',
    'coinos.io',
    'speed.app',
    'ln.tips',
    'stacker.news',
    'cash.app',
    'river.com',
    'fountain.fm',
    'lnbits.com',
    'zaphq.io',
    'breez.technology',
    'muun.com',
    'phoenix.acinq.co',
];

// lnbits.com is an exact host. Other custodians still match their subdomains.
const EXACT_HOSTS = { 'lnbits.com': true };

function hostAllowed(hostname) {
    const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
    if (!host || host.indexOf('..') !== -1) return false;
    for (let i = 0; i < VERIFY_HOSTS.length; i++) {
        const domain = VERIFY_HOSTS[i];
        if (host === domain) return true;
        if (EXACT_HOSTS[domain]) continue;
        if (host.endsWith('.' + domain)) return true;
    }
    return false;
}

function verifyHost(verifyUrl) {
    const safe = safeVerifyUrl(verifyUrl);
    if (!safe) return '';
    try { return new URL(safe).hostname.toLowerCase(); } catch (e) { return ''; }
}

function tokensOf(value) {
    if (!value) return [];
    const raw = Array.isArray(value) ? value : String(value).split(/[,\s]+/);
    const out = [];
    raw.forEach(function (item) {
        const text = String(item || '').trim().toLowerCase();
        if (text) out.push(text);
    });
    return out;
}

function sharesCluster(left, right) {
    if (!left || !right) return false;
    const fpA = String(left.fingerprint || '').trim();
    const fpB = String(right.fingerprint || '').trim();
    if (fpA && fpB && fpA === fpB) return true;
    const ipsA = tokensOf(left.known_ips).concat(tokensOf(left.ipHashes));
    const ipsB = tokensOf(right.known_ips).concat(tokensOf(right.ipHashes));
    if (left.ipHash) ipsA.push(String(left.ipHash).trim().toLowerCase());
    if (right.ipHash) ipsB.push(String(right.ipHash).trim().toLowerCase());
    if (!ipsA.length || !ipsB.length) return false;
    const seen = {};
    ipsB.forEach(function (ip) { if (ip) seen[ip] = true; });
    for (let i = 0; i < ipsA.length; i++) {
        if (ipsA[i] && seen[ipsA[i]]) return true;
    }
    return false;
}

function decide(input) {
    const src = input || {};
    const senderUid = String(src.senderUid || '');
    const recipientUid = String(src.recipientUid || '');
    const stored = src.stored || null;
    if (!stored || !stored.paymentHash) return { credit: false, reason: 'no-server-invoice', sats: 0 };
    if (stored.senderUid !== senderUid || stored.recipientUid !== recipientUid) {
        return { credit: false, reason: 'invoice-mismatch', sats: 0 };
    }
    if (!senderUid || !recipientUid || senderUid === recipientUid) {
        return { credit: false, reason: 'self', sats: 0 };
    }
    const host = src.verifyHost || verifyHost(src.verifyUrl);
    if (!hostAllowed(host)) return { credit: false, reason: 'verify-host', sats: 0 };
    if (rewardBlocked(src.sender, src.senderLedger) || rewardBlocked(src.recipient, src.recipientLedger)) {
        return { credit: false, reason: 'banned', sats: 0 };
    }
    if (sharesCluster(src.sender, src.recipient)) return { credit: false, reason: 'cluster', sats: 0 };
    if (src.pairUsed) return { credit: false, reason: 'pair-cap', sats: 0 };
    const decoded = Math.floor(Number(src.decodedSats) || 0);
    const storedSats = Math.floor(Number(stored.sats) || 0);
    if (decoded <= 0 || decoded !== storedSats) return { credit: false, reason: 'amount', sats: 0 };
    return { credit: true, reason: 'server-invoice', sats: decoded };
}

module.exports = {
    VERIFY_HOSTS: VERIFY_HOSTS,
    hostAllowed: hostAllowed,
    verifyHost: verifyHost,
    sharesCluster: sharesCluster,
    decide: decide,
};
