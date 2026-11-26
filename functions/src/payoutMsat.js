'use strict';
// Shared millisatoshi helpers for payout reserves and caps.
// Count spend in msat (always round up from fractional sats). Prize caps
// (per-claim / per-player-day / site-day) stay in whole sats so existing
// 5,000 / 12,600 / 21,000 limits are unchanged for the player-facing amount.
// Wallet-spend counters use msat and include the maximum routing fee so two
// payments cannot sneak under a cap by reserving only the prize.

function satsToMsat(sats) {
    const n = Number(sats);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.ceil(n * 1000);
}

function msatToSatsCeil(msat) {
    const n = Number(msat);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.ceil(n / 1000);
}

function counterSats(data) {
    const n = data ? Number(data.sats) : 0;
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

// Prefer the msat spend field. Legacy docs (sats only) are treated as
// sats * 1000, which is a close stand-in for one-day roll-off.
function counterMsats(data) {
    if (data && data.msats != null) {
        const n = Number(data.msats);
        if (Number.isFinite(n) && n >= 0) return Math.floor(n);
    }
    return satsToMsat(counterSats(data));
}

// Worst-case wallet outflow for one payment: net invoice + max routing fee.
function reserveSpendMsat(netSats, feeLimitMsat) {
    const net = satsToMsat(netSats);
    const fee = Math.max(0, Math.ceil(Number(feeLimitMsat) || 0));
    if (!net) return 0;
    return net + fee;
}

// A prize cap in sats plus the maximum routing fee that cap of prizes
// could attract (same formula as Favor's per-invoice fee limit, applied
// to the cap itself). Three 4,200-sat blocks still fit under 12,600.
function spendCapMsat(prizeCapSats, feeLimitMsatFn) {
    const prize = satsToMsat(prizeCapSats);
    const feeFn = feeLimitMsatFn || function (sats) { return Math.max(10 * 1000, Math.ceil(satsToMsat(sats) * 10000 / 1e6)); };
    return prize + Math.max(0, Math.ceil(Number(feeFn(prizeCapSats)) || 0));
}

function addReserved(data, prizeSats, spendMsat, nowMs, extra) {
    const cur = data || {};
    const row = {
        sats: counterSats(cur) + Math.max(0, Math.floor(Number(prizeSats) || 0)),
        msats: counterMsats(cur) + Math.max(0, Math.ceil(Number(spendMsat) || 0)),
        updatedAtMs: nowMs || Date.now(),
    };
    if (extra) Object.keys(extra).forEach(function (k) { row[k] = extra[k]; });
    return row;
}

function releaseReserved(data, prizeSats, spendMsat, extra) {
    const cur = data || {};
    const row = {
        sats: Math.max(0, counterSats(cur) - Math.max(0, Math.floor(Number(prizeSats) || 0))),
        msats: Math.max(0, counterMsats(cur) - Math.max(0, Math.ceil(Number(spendMsat) || 0))),
    };
    if (extra) Object.keys(extra).forEach(function (k) { row[k] = extra[k]; });
    return row;
}

// After a payment settles, replace the reserved spend with the actual
// wallet outflow (net + paid routing fee, both in msat). Prize sats
// true-up is left to the caller (Favor's budget uses spent, not gross).
function trueUpSpend(data, reservedMsat, actualMsat, prizeDeltaSats, extra) {
    const cur = data || {};
    const reserved = Math.max(0, Math.ceil(Number(reservedMsat) || 0));
    const actual = Math.max(0, Math.ceil(Number(actualMsat) || 0));
    const prizeDelta = Math.floor(Number(prizeDeltaSats) || 0);
    const row = {
        sats: Math.max(0, counterSats(cur) + prizeDelta),
        msats: Math.max(0, counterMsats(cur) - reserved + actual),
    };
    if (extra) Object.keys(extra).forEach(function (k) { row[k] = extra[k]; });
    return row;
}

function reservedMsatFromClaim(cur, fallbackPrizeSats, fallbackFeeLimitMsat) {
    if (cur && cur.reservedMsat != null) {
        const n = Number(cur.reservedMsat);
        if (Number.isFinite(n) && n >= 0) return Math.floor(n);
    }
    return reserveSpendMsat(fallbackPrizeSats, fallbackFeeLimitMsat);
}

module.exports = {
    satsToMsat: satsToMsat,
    msatToSatsCeil: msatToSatsCeil,
    counterSats: counterSats,
    counterMsats: counterMsats,
    reserveSpendMsat: reserveSpendMsat,
    spendCapMsat: spendCapMsat,
    addReserved: addReserved,
    releaseReserved: releaseReserved,
    trueUpSpend: trueUpSpend,
    reservedMsatFromClaim: reservedMsatFromClaim,
};
