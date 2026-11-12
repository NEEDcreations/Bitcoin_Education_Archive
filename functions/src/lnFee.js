'use strict';

// Flat Lightning fee charged to the player on every sats payout.
// Pinned @getalby/sdk 7.0.0 Nip47PayInvoiceRequest is { invoice, metadata?, amount? }.
// NIP-47 pay_invoice has no per-payment max fee. The routing ceiling is the
// wallet's own limit (Alby Hub), not a field this server can set.
// Phil, Nov 2 2026: the player pays routing fees out of the claim. We take one
// standard amount; whatever routing does not use stays in the wallet.
// Measured on 73 real faucet payouts (Oct 22 to Nov 2 2026): median 0.61,
// p90 2.30, p95 2.35, max 2.79 sats. This is the only place the server value lives.
const LN_FEE_SATS = 10;
// The player must always receive at least this much after the fee.
const MIN_NET_SATS = 1;

const FEE_TOO_BIG = 'This claim is too small to cover the Lightning fee.';
const INVOICE_REJECTED = 'That invoice cannot be paid. Ask your wallet for a new one.';
// 288 blocks is 48 hours. Ordinary invoices use a much smaller final CLTV.
const MAX_FINAL_CLTV = 288;

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

function tagName(tag) {
    return String((tag && (tag.tagName || tag.tag)) || '').toLowerCase();
}

// Reject route hints (BOLT11 `r` / routing_info) and a final CLTV above 288.
// Checked before pay_invoice. The Alby SDK request has no fee-limit field.
function assessOutgoingInvoice(decoded) {
    const tags = decoded && Array.isArray(decoded.tags) ? decoded.tags : [];
    let cltv = null;
    if (decoded && decoded.minFinalCltvExpiry != null && decoded.minFinalCltvExpiry !== '') {
        const top = Number(decoded.minFinalCltvExpiry);
        if (Number.isFinite(top)) cltv = top;
    }
    for (let i = 0; i < tags.length; i++) {
        const name = tagName(tags[i]);
        if (name === 'routing_info' || name === 'r') {
            return { ok: false, error: INVOICE_REJECTED, reason: 'route_hint' };
        }
        if (name === 'min_final_cltv_expiry' || name === 'c') {
            const n = Number(tags[i].data);
            if (Number.isFinite(n)) cltv = n;
        }
    }
    if (cltv != null && cltv > MAX_FINAL_CLTV) {
        return { ok: false, error: INVOICE_REJECTED, reason: 'cltv', cltv: cltv };
    }
    return { ok: true, cltv: cltv };
}

function feeExceeded(charged, payResult) {
    const paid = feePaidSats(payResult);
    if (paid == null) return false;
    return paid > Math.floor(Number(charged) || 0);
}

function feeFields(q, payResult) {
    const paid = feePaidSats(payResult);
    const out = { fee_charged: q.fee, net_sent: q.net, gross: q.gross, fee_paid: paid };
    if (payResult && Number.isFinite(Number(payResult.fees_paid))) out.fee_paid_msat = Math.max(0, Math.floor(Number(payResult.fees_paid)));
    return out;
}

module.exports = {
    LN_FEE_SATS, MIN_NET_SATS, FEE_TOO_BIG, INVOICE_REJECTED, MAX_FINAL_CLTV,
    quote, feePaidSats, feeFields, assessOutgoingInvoice, feeExceeded,
};
