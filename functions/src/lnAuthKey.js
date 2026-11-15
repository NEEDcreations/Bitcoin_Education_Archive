'use strict';
// LNURL-auth (LUD-04) linking keys are 33-byte compressed secp256k1 public
// keys, sent as 66 hex characters. Anything else is refused before it can
// reach signature checks, uid building or Firestore. Buffer.from(x, 'hex')
// silently stops at the first non-hex character, so a loose key could carry
// extra text into the uid.
const LN_AUTH_KEY_RE = /^0[23][0-9a-f]{64}$/i;

// Returns the lowercased key, or null when it is not a compressed hex pubkey.
function normalizeLnAuthKey(key) {
    if (typeof key !== 'string' || !LN_AUTH_KEY_RE.test(key)) return null;
    return key.toLowerCase();
}

module.exports = { LN_AUTH_KEY_RE, normalizeLnAuthKey };
