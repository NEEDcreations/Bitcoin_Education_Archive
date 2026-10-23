'use strict';

const crypto = require('crypto');

const MIN_SECRET = 16;

function hmacIp(ip, secret) {
    const key = secret == null ? String(process.env.REFERRAL_IP_HMAC_SECRET || '') : String(secret);
    if (key.length < MIN_SECRET) {
        const err = new Error('referral-ip-secret-missing');
        err.code = 'failed-precondition';
        throw err;
    }
    const text = String(ip || '').trim().toLowerCase();
    if (!text) return '';
    return crypto.createHmac('sha256', key).update(text).digest('hex');
}

module.exports = { hmacIp: hmacIp, MIN_SECRET: MIN_SECRET };
