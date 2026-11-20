'use strict';

const SECRET_ENV = 'CIPHER_ROLL_SECRET';
const MIN_SECRET_LEN = 16;

function cipherRollKey(raw) {
    const value = raw == null ? (process.env[SECRET_ENV] || '') : raw;
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (trimmed.length < MIN_SECRET_LEN) return '';
    return trimmed;
}

function secretReady(raw) {
    return !!cipherRollKey(raw);
}

module.exports = {
    SECRET_ENV: SECRET_ENV,
    MIN_SECRET_LEN: MIN_SECRET_LEN,
    cipherRollKey: cipherRollKey,
    secretReady: secretReady,
};
