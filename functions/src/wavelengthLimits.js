'use strict';
// Approved Wavelength payout limits (Phil, Nov 5 2026). Amounts in sats.
// These are the Decision 4 numbers. They can be overridden by
// config/payoutRail fields of the same name; the defaults below are the floor
// (a config value may only lower a cap, never raise it).

const LIMITS = Object.freeze({
    FLOAT_CEILING_SATS: 15000,
    REFILL_UNDER_SATS: 5000,
    PER_TX_SATS: 2100,
    PER_DAY_SATS: 8000,
    PER_DEST_24H_SATS: 2100,
    ALERT_SATS: 500,
    PHIL_APPROVE_SATS: 1000,
    ADDRESS_COOLDOWN_MS: 48 * 3600 * 1000,
    ADDRESS_ALERT_MS: 72 * 3600 * 1000,
});

function posInt(v, cap, fallback) {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.min(n, cap);
}

function readLimits(cfg) {
    const c = cfg || {};
    return {
        floatCeilingSats: posInt(c.floatCeilingSats, LIMITS.FLOAT_CEILING_SATS, LIMITS.FLOAT_CEILING_SATS),
        refillUnderSats: posInt(c.refillUnderSats, LIMITS.FLOAT_CEILING_SATS, LIMITS.REFILL_UNDER_SATS),
        perTxSats: posInt(c.perTxSats, LIMITS.PER_TX_SATS, LIMITS.PER_TX_SATS),
        perDaySats: posInt(c.perDaySats, LIMITS.PER_DAY_SATS, LIMITS.PER_DAY_SATS),
        perDest24hSats: posInt(c.perDest24hSats, LIMITS.PER_DEST_24H_SATS, LIMITS.PER_DEST_24H_SATS),
        alertSats: posInt(c.alertSats, LIMITS.ALERT_SATS, LIMITS.ALERT_SATS),
        philApproveSats: posInt(c.philApproveSats, LIMITS.PHIL_APPROVE_SATS, LIMITS.PHIL_APPROVE_SATS),
        addressCooldownMs: posInt(c.addressCooldownMs, LIMITS.ADDRESS_COOLDOWN_MS, LIMITS.ADDRESS_COOLDOWN_MS),
        addressAlertMs: posInt(c.addressAlertMs, LIMITS.ADDRESS_ALERT_MS, LIMITS.ADDRESS_ALERT_MS),
    };
}

module.exports = { LIMITS: LIMITS, readLimits: readLimits, posInt: posInt };
