'use strict';

// Tipping daily challenge. The invoice is usually someone else's LNURL, so
// payment often cannot be observed. A signed-in user may confirm "I sent the
// tip" once per UTC day. When that day’s challenge is a tip, the server awards
// its XP. LUD-21 / our NWC lookup can mark the row verified first; a failed
// lookup still falls back to the confirmation.

const TIP_CHALLENGE_XP = 100;

// Same order as DAILY_CHALLENGES in mobile-ux.js. The day index is UTC.
const CHALLENGE_IDS = [
    'read', 'nacho', 'quiz', 'explore', 'forum', 'streak', 'favorite',
    'tctv_10m', 'tctv_visit', 'tctv_3ch', 'tctv_30m',
    'tip_send', 'tip_3',
    'ln_setup', 'chat_msg', 'pvp_battle', 'beats_listen', 'explore_5', 'nacho_3',
];

const TIP_CHALLENGE_IDS = { tip_send: true, tip_3: true };

function utcDateKey(nowMs) {
    return new Date(Number(nowMs) || Date.now()).toISOString().split('T')[0];
}

function challengeIdForDate(utcDate) {
    const key = String(utcDate || '');
    const dayNum = Math.floor(Date.parse(key + 'T00:00:00Z') / 86400000);
    if (!isFinite(dayNum)) return CHALLENGE_IDS[0];
    const index = ((dayNum % CHALLENGE_IDS.length) + CHALLENGE_IDS.length) % CHALLENGE_IDS.length;
    return CHALLENGE_IDS[index];
}

function isTippingChallenge(challengeId) {
    return !!TIP_CHALLENGE_IDS[challengeId];
}

function decideTipConfirm(input) {
    const src = input || {};
    const today = String(src.today || '');
    const confirmedDate = src.confirmedDate ? String(src.confirmedDate) : '';
    const challengeId = src.challengeId || challengeIdForDate(today);
    const tipping = isTippingChallenge(challengeId);
    if (confirmedDate && today && confirmedDate === today) {
        return {
            record: false,
            awardXp: 0,
            already: true,
            challengeCompleted: false,
            challengeId: challengeId,
        };
    }
    if (!tipping) {
        return {
            record: true,
            awardXp: 0,
            already: false,
            challengeCompleted: false,
            challengeId: challengeId,
            reason: 'not-tip-day',
        };
    }
    return {
        record: true,
        awardXp: TIP_CHALLENGE_XP,
        already: false,
        challengeCompleted: true,
        challengeId: challengeId,
    };
}

function isPrivateHost(hostname) {
    const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
    if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
    if (host === '::1' || host.indexOf('fd') === 0) return true;
    const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (!m) return false;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    return false;
}

// Only https LUD-21 URLs are fetched, and redirects are not followed.
function safeVerifyUrl(raw) {
    const text = String(raw || '').trim();
    if (!text || text.length > 500) return '';
    let url;
    try { url = new URL(text); } catch (e) { return ''; }
    if (url.protocol !== 'https:') return '';
    if (url.username || url.password) return '';
    if (isPrivateHost(url.hostname)) return '';
    return url.toString();
}

function interpretLud21(status, body) {
    if (status !== 200 || !body || typeof body !== 'object') {
        return { verified: false, reason: 'lud21-unverified' };
    }
    if (body.settled === true || body.settled === 'true') {
        return { verified: true, reason: 'lud21' };
    }
    return { verified: false, reason: 'lud21-not-settled' };
}

function interpretNwcLookup(invoice) {
    if (!invoice || typeof invoice !== 'object') {
        return { verified: false, reason: 'nwc-not-found' };
    }
    const state = String(invoice.state || invoice.status || '').toLowerCase();
    if (invoice.preimage || invoice.settled === true || state === 'settled' || state === 'paid') {
        return { verified: true, reason: 'nwc' };
    }
    return { verified: false, reason: 'nwc-not-settled' };
}

function normalizePaymentHash(raw) {
    const hash = String(raw || '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(hash)) return '';
    return hash;
}

module.exports = {
    TIP_CHALLENGE_XP: TIP_CHALLENGE_XP,
    CHALLENGE_IDS: CHALLENGE_IDS,
    utcDateKey: utcDateKey,
    challengeIdForDate: challengeIdForDate,
    isTippingChallenge: isTippingChallenge,
    decideTipConfirm: decideTipConfirm,
    isPrivateHost: isPrivateHost,
    safeVerifyUrl: safeVerifyUrl,
    interpretLud21: interpretLud21,
    interpretNwcLookup: interpretNwcLookup,
    normalizePaymentHash: normalizePaymentHash,
};
