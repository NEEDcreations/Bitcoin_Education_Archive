'use strict';

// SSRF guard: resolve a hostname and reject if any address is private,
// loopback, or link-local. A string check is not enough — a public name can
// point at 169.254.169.254. Call this before any fetch of a user-supplied host.

const dns = require('dns').promises;

async function assertPublicHost(hostname) {
    const host = String(hostname || '').split(':')[0].toLowerCase();
    let addresses;
    try {
        addresses = await dns.resolve4(host);
        try {
            const v6 = await dns.resolve6(host);
            addresses = addresses.concat(v6);
        } catch (_) { /* no AAAA record */ }
    } catch (e) {
        throw new Error('DNS resolution failed for hostname: ' + host);
    }
    if (!addresses || addresses.length === 0) throw new Error('No DNS records for hostname: ' + host);
    for (let i = 0; i < addresses.length; i++) {
        const a = String(addresses[i] || '').toLowerCase();
        if (
            a === '127.0.0.1' ||
            a === '::1' ||
            /^127\./.test(a) ||
            /^10\./.test(a) ||
            /^192\.168\./.test(a) ||
            /^172\.(1[6-9]|2[0-9]|3[01])\./.test(a) ||
            /^169\.254\./.test(a) ||
            /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(a) ||
            /^fd[0-9a-f]{2}:/i.test(a) ||
            /^fe80:/i.test(a) ||
            /^::ffff:127\./.test(a) ||
            /^0\./.test(a)
        ) {
            console.error('[SSRF-DNS] Blocked private IP ' + addresses[i] + ' for host ' + host);
            throw new Error('Hostname resolves to a private/restricted IP address.');
        }
    }
}

module.exports = { assertPublicHost: assertPublicHost };
