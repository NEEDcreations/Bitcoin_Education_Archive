'use strict';

const crypto = require('crypto');

const MIN_SECRET = 16;

function hmacKey(secret) {
    const key = secret == null ? String(process.env.REFERRAL_IP_HMAC_SECRET || '') : String(secret);
    if (key.length < MIN_SECRET) {
        const err = new Error('referral-ip-secret-missing');
        err.code = 'failed-precondition';
        throw err;
    }
    return key;
}

function hmacIp(ip, secret) {
    const key = hmacKey(secret);
    const text = String(ip || '').trim().toLowerCase();
    if (!text) return '';
    return crypto.createHmac('sha256', key).update(text).digest('hex');
}

// Device ids are case-sensitive. Do not lowercase them the way IPs are.
function hmacValue(value, secret) {
    const key = hmacKey(secret);
    const text = String(value || '').trim();
    if (!text) return '';
    return crypto.createHmac('sha256', key).update(text).digest('hex');
}

module.exports = { hmacIp: hmacIp, hmacValue: hmacValue, MIN_SECRET: MIN_SECRET };
