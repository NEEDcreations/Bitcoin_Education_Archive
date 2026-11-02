'use strict';

// Flat Lightning fee charged to the player on every sats payout.
// Phil, Nov 2 2026: the player pays routing fees out of the claim. We take one
// standard amount; whatever routing does not use stays in the wallet.
// Measured on 73 real faucet payouts (Oct 22 to Nov 2 2026): median 0.61,
// p90 2.30, p95 2.35, max 2.79 sats. This is the only place the server value lives.
const LN_FEE_SATS = 3;
// The player must always receive at least this much after the fee.
const MIN_NET_SATS = 1;

const FEE_TOO_BIG = 'This claim is too small to cover the Lightning fee.';

function quote(gross, feeSats) {
    const g = Math.floor(Number(gross));
    const fee = feeSats === undefined ? LN_FEE_SATS : Math.floor(Number(feeSats));
    if (!Number.isFinite(g) || g <= 0 || !Number.isFinite(fee) || fee < 0) {
        return { ok: false, gross: 0, fee: 0, net: 0, error: FEE_TOO_BIG };
    }
    const net = g - fee;
    if (!(net >= MIN_NET_SATS)) return { ok: false, gross: g, fee: fee, net: 0, error: FEE_TOO_BIG };
    return { ok: true, gross: g, fee: fee, net: net };
}

// fees_paid from NWC is in millisats. Returns whole sats rounded up, or null when unknown.
function feePaidSats(payResult) {
    if (!payResult || payResult.fees_paid === undefined || payResult.fees_paid === null) return null;
    const ms = Number(payResult.fees_paid);
    if (!Number.isFinite(ms) || ms < 0) return null;
    return Math.ceil(ms / 1000);
}

function feeFields(q, payResult) {
    const paid = feePaidSats(payResult);
    const out = { fee_charged: q.fee, net_sent: q.net, gross: q.gross, fee_paid: paid };
    if (payResult && Number.isFinite(Number(payResult.fees_paid))) out.fee_paid_msat = Math.max(0, Math.floor(Number(payResult.fees_paid)));
    return out;
}

module.exports = { LN_FEE_SATS, MIN_NET_SATS, FEE_TOO_BIG, quote, feePaidSats, feeFields };
