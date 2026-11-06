// The Lightning payout wallet (Nostr Wallet Connect URL) lives in Secret
// Manager as NWC_URL. Only functions that list `nwcUrlSecret` in their
// `secrets` get it at runtime; every other function sees an empty string.
// Never put NWC_URL in functions/.env: the deploy refuses a key that is both
// a plain env var and a secret, and .env files leak.
const { defineSecret } = require('firebase-functions/params');

const nwcUrlSecret = defineSecret('NWC_URL');

// Read at call time, not at module load, so an unbound function never
// caches a value and a rotated secret is picked up by new instances.
function nwcUrl() {
    return process.env.NWC_URL || '';
}

module.exports = { nwcUrlSecret, nwcUrl };
