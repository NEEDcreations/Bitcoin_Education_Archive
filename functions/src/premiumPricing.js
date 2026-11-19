'use strict';

// Bitcoin Quest Premium: plans, prices and discounts. Pure functions only.
// The server is the only place a price is computed. The client never sends an
// amount; it sends a plan id, a rail ('card' or 'lightning') and, for prepaid
// Lightning months, a month count.
//
// Decided by Phil (Nov 14, 2026):
//   $5/mo, $50/yr, $150 Founders' Lifetime (exactly 500 seats),
//   Family/Classroom $9.99/mo (inactive until adult ID verification exists).
//   Lightning (BTCPay) sells Yearly, Founders' Lifetime and prepaid months only,
//   10% off, shown only on checkout.
//   Existing users: 5% off by card, 15% total with bitcoin (5% + 10%, added),
//   until Jan 1, 2027 12:00 AM ET.
// Configurable in premium_config/settings (server-only): the percentages, the
// stacking mode (default 'additive'), the existing-user cutoff and end time,
// and lightningEnabled (default false until Phil's receive-only wallet exists).
//
// Decided by Phil (Nov 18, 2026):
//   Every plan is charged at purchase. No deferred billing.
//   Embers and Citadel perks start Jan 3, 2027 12:00 AM ET (perksStartAt);
//   every other perk starts at purchase.
//   No free trial for anyone until Phil turns trials on (about early Feb 2027).
//   trialsEnabled is fail-closed: absent or anything but true = no trial.
//   No refunds on any plan (REFUND_POLICY). Founders' seats never return.

const FOUNDERS_CAP = 500; // exactly 500 seats; never read from config.
const MAX_PREPAID_MONTHS = 12;

// Jan 1, 2027 00:00 America/New_York (EST, UTC-5) = 05:00 UTC.
const EXISTING_DISCOUNT_ENDS_MS = Date.parse('2027-01-01T05:00:00.000Z');
// Jan 3, 2027 00:00 America/New_York (EST, UTC-5) = 05:00 UTC. Embers and
// Citadel perks for anyone who buys before then start at this instant.
const PERKS_START_MS = Date.parse('2027-01-03T05:00:00.000Z');
const MAX_TRIAL_DAYS = 14;

// Phil, Nov 18: no refunds. Shown before payment (in-app buy screen, /premium,
// Stripe custom_text) and stamped on every order as refundPolicy.
const REFUND_POLICY = Object.freeze({
    id: 'final_sale_2026_11_18',
    text: 'All sales are final. No refunds. Monthly and Yearly plans can be canceled any time and keep Premium until the end of the period you paid for. Founders\' Lifetime and bitcoin payments are final.',
});

const PLANS = Object.freeze({
    monthly: { id: 'monthly', label: 'Premium Monthly', baseCents: 500, card: 'subscription', interval: 'month', lightning: false },
    yearly: { id: 'yearly', label: 'Premium Yearly', baseCents: 5000, card: 'subscription', interval: 'year', lightning: true, termMonths: 12 },
    founders: { id: 'founders', label: "Founders' Lifetime", baseCents: 15000, card: 'payment', lightning: true, lifetime: true },
    months: { id: 'months', label: 'Premium prepaid months', baseCents: 500, card: false, lightning: true, perMonth: true },
    family_monthly: { id: 'family_monthly', label: 'Family/Classroom', baseCents: 999, card: 'subscription', interval: 'month', lightning: false, family: true },
    family_months: { id: 'family_months', label: 'Family/Classroom prepaid months', baseCents: 999, card: false, lightning: true, perMonth: true, family: true },
});

const DEFAULT_CONFIG = Object.freeze({
    checkoutEnabled: false,
    lightningEnabled: false,
    btcDiscountPct: 10,
    existingUserDiscountPct: 5,
    stackMode: 'additive', // Phil, Nov 14 1:15 PM ET: 5% + 10% = 15% with bitcoin
    existingUserDiscountEndsAtMs: EXISTING_DISCOUNT_ENDS_MS,
    // "Existing user" = Auth account created before this time. Default is
    // checkoutLaunchedAtMs; existingUserCutoffMs overrides it.
    existingUserCutoffMs: null,
    checkoutLaunchedAtMs: null,
    // Embers + Citadel perks start here. Billing is never deferred.
    // Config may move it (perksStartAt ISO string or perksStartAtMs).
    perksStartAtMs: PERKS_START_MS,
    // Fail-closed trial switch: only trialsEnabled === true turns trials on,
    // and then only with a valid trialDays of 1..14. Off for everyone until
    // Phil picks the date (about early Feb 2027).
    trialsEnabled: false,
    trialDays: 0, // first subscription only; ignored unless trialsEnabled
    // Security (Red Team, Nov 14): global cap on public-page orders per hour,
    // across every IP. Per-IP limit still applies on top.
    publicOrdersPerHour: 60,
    // Founders' seats held in open checkouts at once, across everyone.
    maxLiveFoundersHolds: 25,
    // Alert (review row) when live holds stay at or above this for over an hour.
    foundersHoldsAlertThreshold: 15,
    // Data/Backups (Nov 14): plain email on an unclaimed public order is
    // cleared this many months after purchase (or at once on a full refund).
    // Pending Phil's OK on the 24-month default.
    publicOrderEmailRetentionMonths: 24,
    // Stripe billing portal configuration id (bpc_...). Required: the portal
    // refuses to open without it, so promotion codes and plan switches stay
    // off (see functions/scripts/premium-portal-config.js).
    stripePortalConfigId: null,
    // Founders' Lifetime checkout requires a verified email (in-app; the
    // public page still refuses Founders with founders_sign_in). Default on.
    foundersRequireVerifiedEmail: true,
});

function intIn(v, lo, hi, dflt) {
    const n = Number(v);
    return (v != null && Number.isInteger(n) && n >= lo && n <= hi) ? n : dflt;
}

function pct(v, fallback) {
    const n = Number(v);
    if (v === null || v === undefined || v === '' || !Number.isFinite(n) || n < 0 || n > 25 || Math.floor(n) !== n) return fallback;
    return n;
}
function ms(v) {
    const n = Number(v);
    if (v === null || v === undefined || !Number.isFinite(n) || n <= 0) return null;
    return Math.floor(n);
}

// Validates the config doc. Anything malformed falls back to the default, so a
// typo can never produce a bigger discount than Phil decided.
function normalizeConfig(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    return {
        checkoutEnabled: r.checkoutEnabled === true,
        lightningEnabled: r.lightningEnabled === true,
        btcDiscountPct: pct(r.btcDiscountPct, DEFAULT_CONFIG.btcDiscountPct),
        existingUserDiscountPct: pct(r.existingUserDiscountPct, DEFAULT_CONFIG.existingUserDiscountPct),
        stackMode: r.stackMode === 'sequential' ? 'sequential' : 'additive',
        // Config may end the 5% offer earlier, never later than 2027-01-01 00:00 ET.
        existingUserDiscountEndsAtMs: Math.min(ms(r.existingUserDiscountEndsAtMs) || EXISTING_DISCOUNT_ENDS_MS, EXISTING_DISCOUNT_ENDS_MS),
        existingUserCutoffMs: ms(r.existingUserCutoffMs),
        checkoutLaunchedAtMs: ms(r.checkoutLaunchedAtMs),
        // billingStartsAt (old deferred-billing flag) is ignored on purpose.
        perksStartAtMs: (typeof r.perksStartAt === 'string' ? ms(Date.parse(r.perksStartAt)) : ms(r.perksStartAtMs != null ? r.perksStartAtMs : r.perksStartAt)) || PERKS_START_MS,
        trialsEnabled: r.trialsEnabled === true,
        // 0 unless trialsEnabled === true AND trialDays is an integer 1..14.
        trialDays: r.trialsEnabled === true ? intIn(r.trialDays, 1, MAX_TRIAL_DAYS, 0) : 0,
        publicOrdersPerHour: intIn(r.publicOrdersPerHour, 1, 10000, DEFAULT_CONFIG.publicOrdersPerHour),
        maxLiveFoundersHolds: intIn(r.maxLiveFoundersHolds, 1, FOUNDERS_CAP, DEFAULT_CONFIG.maxLiveFoundersHolds),
        foundersHoldsAlertThreshold: intIn(r.foundersHoldsAlertThreshold, 1, FOUNDERS_CAP, DEFAULT_CONFIG.foundersHoldsAlertThreshold),
        publicOrderEmailRetentionMonths: intIn(r.publicOrderEmailRetentionMonths, 1, 120, DEFAULT_CONFIG.publicOrderEmailRetentionMonths),
        stripePortalConfigId: typeof r.stripePortalConfigId === 'string' && /^bpc_[A-Za-z0-9]{6,80}$/.test(r.stripePortalConfigId) ? r.stripePortalConfigId : null,
        // Absent or any value other than false stays on (Red Team, Nov 14).
        foundersRequireVerifiedEmail: r.foundersRequireVerifiedEmail !== false,
    };
}

function existingUserCutoff(cfg) {
    return cfg.existingUserCutoffMs || cfg.checkoutLaunchedAtMs || null;
}

// accountCreatedMs: Firebase Auth metadata.creationTime, read on the server.
function isExistingUser(accountCreatedMs, cfg) {
    const cutoff = existingUserCutoff(cfg);
    const created = Number(accountCreatedMs);
    if (!cutoff || !Number.isFinite(created) || created <= 0) return false;
    return created < cutoff;
}

function applyDiscounts(baseCents, pcts, mode) {
    const list = pcts.filter(function (p) { return p > 0; });
    if (!list.length) return baseCents;
    if (mode === 'sequential') {
        let num = baseCents;
        let den = 1;
        list.forEach(function (p) { num *= (100 - p); den *= 100; });
        return Math.round(num / den);
    }
    const total = Math.min(100, list.reduce(function (a, b) { return a + b; }, 0));
    return Math.round(baseCents * (100 - total) / 100);
}

class PricingError extends Error {
    constructor(code, message) { super(message); this.code = code; }
}

// Returns the server price for one order. Throws PricingError on anything not
// sold. Family plans are always refused until adult ID verification ships.
function quote(input, rawConfig) {
    const cfg = normalizeConfig(rawConfig);
    const planId = input && input.plan;
    const plan = typeof planId === 'string' && Object.prototype.hasOwnProperty.call(PLANS, planId) ? PLANS[planId] : null;
    const rail = input && input.rail;
    if (!plan) throw new PricingError('bad_plan', 'Unknown plan.');
    if (rail !== 'card' && rail !== 'lightning') throw new PricingError('bad_rail', 'Pick card or Lightning.');
    if (plan.family) throw new PricingError('family_inactive', 'Family/Classroom opens after adult ID verification is ready.');
    if (rail === 'card' && !plan.card) throw new PricingError('rail_not_offered', 'This plan is Lightning only.');
    if (rail === 'lightning' && !plan.lightning) throw new PricingError('rail_not_offered', 'Pay monthly by card, or buy prepaid months with Lightning.');
    let months = 0;
    if (plan.perMonth) {
        months = Number(input.months);
        if (!Number.isInteger(months) || months < 1 || months > MAX_PREPAID_MONTHS) {
            throw new PricingError('bad_months', 'Pick 1 to ' + MAX_PREPAID_MONTHS + ' months.');
        }
    }
    const nowMs = Number(input.nowMs);
    // existingUserEligible is decided by the caller from a verified, signed-in
    // account (premium.existingUserEligible). The public page always passes false.
    const existing = input.existingUserEligible === true && nowMs < cfg.existingUserDiscountEndsAtMs;
    const pcts = [];
    const discounts = [];
    if (existing && cfg.existingUserDiscountPct > 0) {
        pcts.push(cfg.existingUserDiscountPct);
        discounts.push({ kind: 'existing_user', pct: cfg.existingUserDiscountPct });
    }
    if (rail === 'lightning' && cfg.btcDiscountPct > 0) {
        pcts.push(cfg.btcDiscountPct);
        discounts.push({ kind: 'bitcoin', pct: cfg.btcDiscountPct });
    }
    const unitCents = applyDiscounts(plan.baseCents, pcts, cfg.stackMode);
    const qty = plan.perMonth ? months : 1;
    return {
        plan: plan.id,
        rail: rail,
        months: months,
        lifetime: !!plan.lifetime,
        cardMode: rail === 'card' ? plan.card : null,
        interval: rail === 'card' && plan.card === 'subscription' ? plan.interval : null,
        termMonths: plan.perMonth ? months : (plan.termMonths || 0),
        baseCents: plan.baseCents * qty,
        unitCents: unitCents,
        amountCents: unitCents * qty,
        currency: 'usd',
        discounts: discounts,
        stackMode: cfg.stackMode,
        existingUser: existing,
        label: plan.label,
    };
}

function centsToUsdString(cents) {
    const c = Math.round(Number(cents));
    return Math.floor(c / 100) + '.' + String(c % 100).padStart(2, '0');
}

// Adds whole calendar months in UTC. Day-of-month clamps (Jan 31 + 1 = Feb 28).
function addMonths(fromMs, months) {
    const d = new Date(fromMs);
    const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
    return target.getTime();
}

module.exports = {
    FOUNDERS_CAP,
    MAX_PREPAID_MONTHS,
    EXISTING_DISCOUNT_ENDS_MS,
    PERKS_START_MS,
    MAX_TRIAL_DAYS,
    REFUND_POLICY,
    PLANS,
    DEFAULT_CONFIG,
    PricingError,
    normalizeConfig,
    isExistingUser,
    existingUserCutoff,
    applyDiscounts,
    quote,
    centsToUsdString,
    addMonths,
};
