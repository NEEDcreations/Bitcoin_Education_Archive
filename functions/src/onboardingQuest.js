'use strict';

// Pure onboarding-quest and guest-link decisions. The callable gathers evidence
// with the Admin SDK and passes it here. Client flags never grant a reward.

const BEGINNER_STEPS = ['pick_topic', 'find_nacho', 'first_quiz'];
const MODES = {
    lite: BEGINNER_STEPS,
    beginner: BEGINNER_STEPS,
    intermediate: ['pick_topic', 'find_nacho', 'send_chat', 'first_quiz'],
    advanced: ['pick_topic', 'send_chat', 'spin_wheel', 'find_nacho', 'first_quiz'],
};

const STEPS = {
    pick_topic: { evidenceKey: 'channel', pts: 25, tickets: 0 },
    send_chat: { evidenceKey: 'chat', pts: 25, tickets: 0 },
    spin_wheel: { evidenceKey: 'spin', pts: 25, tickets: 0 },
    find_nacho: { evidenceKey: 'nacho', pts: 25, tickets: 0 },
    first_quiz: { evidenceKey: 'quiz', pts: 50, tickets: 2 },
};

const GUEST_POINT_CAP = 500;
const GUEST_TICKET_CAP = 50;
const GUEST_CHANNEL_CAP = 200;
const NONCE_MAX_AGE_MS = 30 * 60 * 1000;
const GUEST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const { planDailyXp } = require('./dailyXp');

function normalizeMode(mode) {
    if (mode === 'lite' || mode === 'beginner' || mode === 'intermediate' || mode === 'advanced') return mode;
    return 'advanced';
}

function stepsForMode(mode) {
    return MODES[normalizeMode(mode)].slice();
}

function catalogTotals(mode) {
    const ids = stepsForMode(mode);
    let pts = 0;
    let tickets = 0;
    for (let i = 0; i < ids.length; i++) {
        const step = STEPS[ids[i]];
        pts += step.pts;
        tickets += step.tickets || 0;
    }
    return { pts: pts, tickets: tickets, steps: ids.length };
}

function ledgerSteps(ledger) {
    const src = ledger && ledger.steps && typeof ledger.steps === 'object' ? ledger.steps : {};
    return src;
}

function isComplete(mode, steps) {
    const ids = stepsForMode(mode);
    for (let i = 0; i < ids.length; i++) {
        const row = steps && steps[ids[i]];
        if (!row || row.granted !== true) return false;
    }
    return ids.length > 0;
}

function decideGrant(input) {
    const src = input || {};
    const step = STEPS[src.stepId];
    if (!step) return { ok: false, error: 'unknown_step', awarded: 0, tickets: 0, complete: false };
    const mode = normalizeMode(src.mode);
    if (stepsForMode(mode).indexOf(src.stepId) === -1) {
        return { ok: false, error: 'not_in_mode', awarded: 0, tickets: 0, complete: false };
    }
    const steps = ledgerSteps(src.ledger);
    // src.completed, src.pts, and src.tickets are ignored on purpose.
    if (steps[src.stepId] && steps[src.stepId].granted === true) {
        return { ok: true, already: true, awarded: 0, tickets: 0, complete: isComplete(mode, steps) };
    }
    const evidence = src.evidence || {};
    if (evidence[step.evidenceKey] !== true) {
        return { ok: false, error: 'not_verified', awarded: 0, tickets: 0, complete: false };
    }
    const next = Object.assign({}, steps);
    next[src.stepId] = { granted: true };
    return {
        ok: true,
        already: false,
        awarded: step.pts,
        tickets: step.tickets || 0,
        complete: isComplete(mode, next),
    };
}

function capInt(value, cap) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(cap, n);
}

function freshAge(value, max) {
    if (value == null || value === '') return false;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return false;
    return n <= max;
}

// Copies only server-side guest totals. clientPoints is ignored.
// A matching nonce that is too old, a guest older than about 7 days, or a
// destination that already absorbed a guest all fail closed.
function planGuestMerge(input) {
    const src = input || {};
    const nonce = String(src.nonce || '');
    const stored = String(src.storedNonce || '');
    if (!nonce || nonce.length < 16 || nonce !== stored) return { ok: false, error: 'bad_nonce' };
    if (src.mergedInto && src.mergedInto !== src.callerUid) return { ok: false, error: 'already_linked' };
    if (src.alreadyMerged === true || (src.mergedInto && src.mergedInto === src.callerUid)) {
        return { ok: true, already: true, points: 0, tickets: 0, channelsVisited: 0 };
    }
    if (!freshAge(src.nonceAgeMs, NONCE_MAX_AGE_MS)) return { ok: false, error: 'expired' };
    if (!freshAge(src.guestAgeMs, GUEST_MAX_AGE_MS)) return { ok: false, error: 'guest_too_old' };
    if (src.destMergedFromGuest === true) return { ok: false, error: 'one_guest' };
    return {
        ok: true,
        already: false,
        points: capInt(src.serverPoints, GUEST_POINT_CAP),
        tickets: capInt(src.serverTickets, GUEST_TICKET_CAP),
        channelsVisited: capInt(src.serverChannels, GUEST_CHANNEL_CAP),
    };
}

// Same shared cap as every other XP grant: full through 500, half through 900, then a quarter until 1,000.
// A guest-point merge does not call this. Weekly and monthly use the awarded part.
function planDailyGrant(input) {
    const src = input || {};
    const split = planDailyXp(Number(src.dailyUsed) || 0, Number(src.amount) || 0);
    return {
        awarded: split.awarded,
        overflowAdded: 0,
        overflowRedeemed: 0,
        pendingOverflow: 0,
        touchOverflow: false,
        pointsOut: split.awarded,
        today: src.today || '',
    };
}

module.exports = {
    MODES,
    STEPS,
    normalizeMode,
    stepsForMode,
    catalogTotals,
    decideGrant,
    isComplete,
    planGuestMerge,
    planDailyGrant,
    GUEST_POINT_CAP,
    GUEST_TICKET_CAP,
    GUEST_CHANNEL_CAP,
    NONCE_MAX_AGE_MS,
    GUEST_MAX_AGE_MS,
};
