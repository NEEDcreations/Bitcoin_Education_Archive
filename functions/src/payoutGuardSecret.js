'use strict';

// Secret Manager key for the anti-drain guard doc ids (antiDrain.js HMAC).
// Bound only on the three Lightning payout callables. Read at call time
// through process.env.PAYOUT_GUARD_HMAC_KEY; never at module load, never in
// functions/.env. Must exist (enabled version, >= 16 chars) and be readable
// by fn-claim-sats, fn-claim-cipher-sats and fn-claim-cipher-win before
// those functions deploy. A missing key refuses payouts (fails closed).
const { defineSecret } = require('firebase-functions/params');

const payoutGuardSecret = defineSecret('PAYOUT_GUARD_HMAC_KEY');

module.exports = { payoutGuardSecret: payoutGuardSecret };
