'use strict';

// BIP Breakthrough (UI: "Bit Devs Socratic Seminar Breakthrough")
// Same BIP for every player each week (questBoard weekKey = Monday 00:00 ET).
// 7 consecutive NY calendar-day daily spins within the week unlocks:
//   - collectible BIP badge (one per BIP)
//   - guaranteed top-tier (rare) prize on the day-7 spin
//   - "Core Contributor" chat title for 7 days
// All awards are server-side, idempotent per weekKey.

const questBoard = require('./questBoard');

const TITLE_ID = 'core_contributor';
const TITLE_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const STREAK_TARGET = 7;

// Curated real BIPs. Numbers/titles checked against bitcoin/bips (2026).
const BIP_CATALOG = [
    {
        id: 'bip_360',
        number: 360,
        short: 'P2MR',
        title: 'Pay-to-Merkle-Root',
        plain: 'A Taproot-style output with the quantum-vulnerable key path removed (script-path only; formerly discussed as P2QRH).',
    },
    {
        id: 'bip_119',
        number: 119,
        short: 'CTV',
        title: 'OP_CHECKTEMPLATEVERIFY',
        plain: 'A narrow covenant opcode that locks a coin to a pre-agreed next transaction template.',
    },
    {
        id: 'bip_347',
        number: 347,
        short: 'OP_CAT',
        title: 'OP_CAT',
        plain: 'Re-enables concatenating two stack values — a building block for covenants and contracts.',
    },
    {
        id: 'bip_118',
        number: 118,
        short: 'ANYPREVOUT',
        title: 'SIGHASH_ANYPREVOUT',
        plain: 'A signature hash mode that omits the input outpoint, unlocking eltoo-style Lightning upgrades.',
    },
    {
        id: 'bip_352',
        number: 352,
        short: 'Silent Payments',
        title: 'Silent Payments',
        plain: 'Lets you publish one address that still gives every payer a unique, unlinkable on-chain destination.',
    },
    {
        id: 'bip_348',
        number: 348,
        short: 'CSFS',
        title: 'OP_CHECKSIGFROMSTACK',
        plain: 'Verifies a Schnorr signature over an arbitrary message from the stack — useful for oracles and covenants.',
    },
    {
        id: 'bip_349',
        number: 349,
        short: 'INTERNALKEY',
        title: 'OP_INTERNALKEY',
        plain: 'Pushes the Taproot internal key onto the stack so scripts can reuse it without restating it.',
    },
    {
        id: 'bip_443',
        number: 443,
        short: 'CCV',
        title: 'OP_CHECKCONTRACTVERIFY',
        plain: 'Lets a UTXO carry committed state and check the next program — state machines on Bitcoin.',
    },
    {
        id: 'bip_353',
        number: 353,
        short: 'DNS Payments',
        title: 'DNS Payment Instructions',
        plain: 'Resolves human-readable Bitcoin payment info from DNS (BIP 21 / Lightning offers).',
    },
    {
        id: 'bip_324',
        number: 324,
        short: 'P2Pv2',
        title: 'Version 2 P2P Encrypted Transport',
        plain: 'Encrypts Bitcoin peer connections so traffic is harder to censor or fingerprint.',
    },
    {
        id: 'bip_85',
        number: 85,
        short: 'BIP85',
        title: 'Deterministic Entropy From BIP32',
        plain: 'Derives fresh mnemonic or entropy child keys from one master seed without storing extras.',
    },
    {
        id: 'bip_86',
        number: 86,
        short: 'P2TR Keys',
        title: 'Key Derivation for Single-Key P2TR',
        plain: 'Standard derivation path for single-key Taproot addresses wallets can agree on.',
    },
];

function catalog() {
    return BIP_CATALOG.slice();
}

function bipById(id) {
    const key = String(id || '');
    for (let i = 0; i < BIP_CATALOG.length; i++) {
        if (BIP_CATALOG[i].id === key) return Object.assign({}, BIP_CATALOG[i]);
    }
    return null;
}

function badgeIdForBip(bip) {
    if (!bip || !bip.id) return '';
    return String(bip.id);
}

/** America/New_York calendar YYYY-MM-DD */
function nyDateKey(ms) {
    const n = Number(ms);
    const when = Number.isFinite(n) ? n : Date.now();
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date(when));
    const get = (t) => {
        for (let i = 0; i < parts.length; i++) {
            if (parts[i].type === t) return parts[i].value;
        }
        return '';
    };
    const y = get('year');
    const m = get('month');
    const d = get('day');
    if (!y || !m || !d) return '';
    return y + '-' + m + '-' + d;
}

function previousNyDateKey(ms) {
    const n = Number(ms);
    const when = Number.isFinite(n) ? n : Date.now();
    return nyDateKey(when - 30 * 3600 * 1000);
}

function weekKeyAt(ms) {
    return questBoard.weekKey(Number.isFinite(Number(ms)) ? Number(ms) : Date.now());
}

// Weekly pick (changed Nov 20, 2026; was a hash of the week key that
// repeated some BIPs early and skipped others for months): a fixed rotation.
// Every BIP in BIP_CATALOG is featured exactly once per cycle, in
// CYCLE_ORDER, then the cycle starts over. Cycle 1 starts the week of
// CYCLE_ANCHOR_WEEK. The launch week (LAUNCH_WEEK, BIP Breakthrough went live
// Thu Nov 5, 2026) sits before cycle 1 and keeps the BIP it actually had.
// CYCLE_ORDER is chosen so every week already shown to players (launch week,
// 2026-11-09, this week 2026-11-16 and the next five on the live schedule)
// keeps the same BIP. resets.html mirrors this; tests/test-resets-page.js and
// tests/test-bip-breakthrough.js check both.
const LAUNCH_WEEK = '2026-11-02';
const LAUNCH_WEEK_BIP_ID = 'bip_85';
const CYCLE_ANCHOR_WEEK = '2026-11-09';
const CYCLE_ORDER = [
    'bip_360', 'bip_119', 'bip_347', 'bip_118', 'bip_324', 'bip_85',
    'bip_86', 'bip_352', 'bip_348', 'bip_349', 'bip_443', 'bip_353',
];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function weekIndexFromAnchor(weekKey) {
    const key = String(weekKey || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
    const t = Date.parse(key + 'T12:00:00Z');
    const a = Date.parse(CYCLE_ANCHOR_WEEK + 'T12:00:00Z');
    if (!Number.isFinite(t)) return null;
    return Math.round((t - a) / WEEK_MS);
}

/** { cycle, position (1-based), length } for a week, or null before cycle 1. */
function cycleInfo(weekKey) {
    const w = weekIndexFromAnchor(weekKey);
    if (w == null || w < 0) return null;
    const n = CYCLE_ORDER.length;
    return { cycle: Math.floor(w / n) + 1, position: (w % n) + 1, length: n };
}

function bipForWeek(weekKey) {
    const key = String(weekKey || '');
    if (key === LAUNCH_WEEK) return bipById(LAUNCH_WEEK_BIP_ID);
    const info = cycleInfo(key);
    if (!info) return null;
    return bipById(CYCLE_ORDER[info.position - 1]);
}

function nyDaysBetween(earlierKey, laterKey) {
    if (!earlierKey || !laterKey) return null;
    const a = Date.parse(earlierKey + 'T12:00:00Z');
    const b = Date.parse(laterKey + 'T12:00:00Z');
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return Math.round((b - a) / 86400000);
}

function planStreak(userData, nowMs) {
    const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
    const todayNy = nyDateKey(now);
    const week = weekKeyAt(now);
    const bip = bipForWeek(week);
    const prev = userData || {};
    const lastDay = typeof prev.bipBreakthroughLastDay === 'string' ? prev.bipBreakthroughLastDay : '';
    const lastWeek = typeof prev.bipBreakthroughWeekKey === 'string' ? prev.bipBreakthroughWeekKey : '';
    const claimedWeek = typeof prev.bipBreakthroughClaimedWeek === 'string' ? prev.bipBreakthroughClaimedWeek : '';
    let streak = Number(prev.bipBreakthroughStreak) || 0;

    const alreadyToday = lastDay === todayNy;
    if (alreadyToday) {
        return {
            todayNy: todayNy,
            weekKey: week,
            bip: bip,
            streak: streak,
            alreadyToday: true,
            completes: false,
            alreadyClaimed: claimedWeek === week,
            update: null,
        };
    }

    if (lastWeek && lastWeek !== week) {
        streak = 0;
    }

    const yesterdayNy = previousNyDateKey(now);
    const consecutive = lastDay && (lastDay === yesterdayNy || nyDaysBetween(lastDay, todayNy) === 1);
    if (consecutive && lastWeek === week) {
        streak = streak + 1;
    } else {
        streak = 1;
    }
    if (streak > STREAK_TARGET) streak = STREAK_TARGET;

    const alreadyClaimed = claimedWeek === week;
    const completes = streak >= STREAK_TARGET && !alreadyClaimed && !!bip;

    const update = {
        bipBreakthroughLastDay: todayNy,
        bipBreakthroughWeekKey: week,
        bipBreakthroughStreak: streak,
        bipBreakthroughBipId: bip ? bip.id : '',
    };

    return {
        todayNy: todayNy,
        weekKey: week,
        bip: bip,
        streak: streak,
        alreadyToday: false,
        completes: completes,
        alreadyClaimed: alreadyClaimed,
        update: update,
    };
}

function claimFields(bip, nowMs, FieldValue) {
    const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
    const week = weekKeyAt(now);
    const until = now + TITLE_DAYS_MS;
    const badgeId = badgeIdForBip(bip);
    const out = {
        bipBreakthroughClaimedWeek: week,
        bipBreakthroughClaimedAt: now,
        bipBreakthroughClaimedBipId: bip ? bip.id : '',
        coreContributorUntil: until,
        coreContributorTitle: TITLE_ID,
        activeTitle: TITLE_ID,
    };
    if (FieldValue && typeof FieldValue.arrayUnion === 'function') {
        out.earnedTitles = FieldValue.arrayUnion(TITLE_ID);
        if (badgeId) out.bipBadges = FieldValue.arrayUnion(badgeId);
    }
    return out;
}

function publicProgress(userData, nowMs) {
    const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
    const week = weekKeyAt(now);
    const bip = bipForWeek(week);
    const prev = userData || {};
    const sameWeek = prev.bipBreakthroughWeekKey === week;
    const streak = sameWeek ? (Number(prev.bipBreakthroughStreak) || 0) : 0;
    const claimed = prev.bipBreakthroughClaimedWeek === week;
    return {
        weekKey: week,
        streak: streak,
        target: STREAK_TARGET,
        claimed: claimed,
        bip: bip,
        coreContributorUntil: Number(prev.coreContributorUntil) || 0,
        titleActive: (Number(prev.coreContributorUntil) || 0) > now,
        bipBadges: Array.isArray(prev.bipBadges) ? prev.bipBadges.slice() : [],
    };
}

module.exports = {
    BIP_CATALOG: BIP_CATALOG,
    TITLE_ID: TITLE_ID,
    TITLE_DAYS_MS: TITLE_DAYS_MS,
    STREAK_TARGET: STREAK_TARGET,
    catalog: catalog,
    bipById: bipById,
    badgeIdForBip: badgeIdForBip,
    nyDateKey: nyDateKey,
    previousNyDateKey: previousNyDateKey,
    weekKeyAt: weekKeyAt,
    bipForWeek: bipForWeek,
    cycleInfo: cycleInfo,
    LAUNCH_WEEK: LAUNCH_WEEK,
    LAUNCH_WEEK_BIP_ID: LAUNCH_WEEK_BIP_ID,
    CYCLE_ANCHOR_WEEK: CYCLE_ANCHOR_WEEK,
    CYCLE_ORDER: CYCLE_ORDER,
    planStreak: planStreak,
    claimFields: claimFields,
    publicProgress: publicProgress,
};
