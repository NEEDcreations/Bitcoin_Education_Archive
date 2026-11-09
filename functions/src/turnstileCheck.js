'use strict';

const fetch = require('node-fetch');
const { turnstileSecretKey } = require('./sensitiveSecrets');

async function verifyTurnstile(token, remoteip) {
    if (!token) return false;
    const secret = turnstileSecretKey();
    if (!secret) {
        console.error('[Turnstile] TURNSTILE_SECRET_KEY is not configured — failing closed');
        return false;
    }
    try {
        const params = new URLSearchParams({ secret: secret, response: token });
        if (remoteip) params.append('remoteip', remoteip);
        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });
        const result = await res.json();
        console.log('[Turnstile] verify result:', result.success, result['error-codes']);
        return result.success === true;
    } catch (e) {
        console.error('[Turnstile] verify error:', e.message);
        return false;
    }
}

module.exports = { verifyTurnstile };
