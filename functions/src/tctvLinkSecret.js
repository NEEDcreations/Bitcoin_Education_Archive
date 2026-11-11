'use strict';

// Secret Manager key for the TCTV drip link ids (exact IP, device, subnet)
// on tctv_drip_watch docs. HMAC-SHA256 only; the raw IP never leaves the
// request and no static salt is used (User Data/Backups + Spam/Abuse #287
// must-fix). Bound only on tctvDripCheckin and read at call time from
// process.env.TCTV_LINK_HMAC_KEY. Must exist (enabled, >= 16 chars) and be
// readable by fn-tctv-drip-checkin before that function deploys. Without
// the key, check-ins still credit but record no link ids.
const crypto = require('crypto');
const { defineSecret } = require('firebase-functions/params');

const SECRET_ENV = 'TCTV_LINK_HMAC_KEY';
const MIN_SECRET_LEN = 16;
const tctvLinkSecret = defineSecret(SECRET_ENV);

function secretValue() {
    const raw = process.env[SECRET_ENV] || '';
    const t = typeof raw === 'string' ? raw.trim() : '';
    return t.length >= MIN_SECRET_LEN ? t : '';
}

function secretReady() {
    return !!secretValue();
}

// '' when the key is missing or there is no value: nothing is stored.
function linkHmac(kind, value) {
    const key = secretValue();
    if (!key || !value) return '';
    return crypto.createHmac('sha256', key).update('bq-tctv-link:v1:' + kind + ':' + String(value), 'utf8').digest('hex').slice(0, 24);
}

module.exports = { SECRET_ENV, tctvLinkSecret, secretReady, linkHmac };
