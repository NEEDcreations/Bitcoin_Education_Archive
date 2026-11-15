'use strict';
// LNURL-auth (LUD-04) input checks for lnAuthCallback / lnAuthVerify.
//
// Buffer.from(x, 'hex') silently stops at the first non-hex character, so a
// valid key followed by markup still verified and the markup ended up in the
// ln: uid. The key check below refuses anything that is not pure hex of a
// public-key length. It deliberately does NOT change which keys log in or
// which uid they map to: compressed (02/03, 66 hex) and uncompressed (04, 130
// hex, uid is the sha256 of the key) both still work, and case is preserved,
// so existing ln: uids are not orphaned. Narrowing to lowercase compressed
// keys waits on a read-only live count of ln: uids by length and case.
const LN_AUTH_KEY_RE = /^(?:0[23][0-9a-fA-F]{64}|04[0-9a-fA-F]{128})$/;
// k1 is 32 random bytes as hex (lnAuthChallenge).
const LN_AUTH_K1_RE = /^[0-9a-fA-F]{64}$/;
// sig is a DER-encoded ECDSA signature: at most 72 bytes, hex, even length.
const LN_AUTH_SIG_RE = /^(?:[0-9a-fA-F]{2}){8,73}$/;
// ln: uids the callback can mint: the key itself (compressed) or the
// lowercase sha256 hex of an uncompressed key.
const LN_UID_RE = /^ln:(?:0[23][0-9a-fA-F]{64}|[0-9a-f]{64})$/;

// Returns the key unchanged when it is a hex public key, else null.
function checkLnAuthKey(key) {
    if (typeof key !== 'string' || !LN_AUTH_KEY_RE.test(key)) return null;
    return key;
}
function isLnAuthK1(k1) { return typeof k1 === 'string' && LN_AUTH_K1_RE.test(k1); }
function isLnAuthSig(sig) { return typeof sig === 'string' && LN_AUTH_SIG_RE.test(sig); }
function isLnUid(uid) { return typeof uid === 'string' && LN_UID_RE.test(uid); }

module.exports = { LN_AUTH_KEY_RE, LN_AUTH_K1_RE, LN_AUTH_SIG_RE, LN_UID_RE, checkLnAuthKey, isLnAuthK1, isLnAuthSig, isLnUid };
