'use strict';

// Fixed ticket amounts and caps. awardPoints does not take a client ticket
// count. These grants are written by the trigger or callable that already
// verified the action, once per offset day (or once ever, for Strava).

const RESET_HOUR_UTC = 5;
const RAID_MAX_PER_GRANT = 50;
const RAID_DAILY_TICKETS = 10;

const ACTIONS = {
    daily_trifecta_ticket: { tickets: 1, label: 'the daily trifecta' },
    nacho_chat_ticket: { tickets: 1, label: 'chatting with Nacho' },
    daily_chat_ticket: { tickets: 2, label: 'global chat' },
    flashcard_ticket: { tickets: 5, label: 'finishing a flashcard deck' },
    forum_post_ticket: { tickets: 1, label: 'a forum post' },
    marketplace_listing_ticket: { tickets: 1, label: 'a marketplace listing' },
    irl_listing_ticket: { tickets: 1, label: 'an IRL listing' },
    tctv_watch_ticket: { tickets: 1, label: 'watching Timechain TV' },
    strava_connect_ticket: { tickets: 5, once: true, label: 'connecting Strava' },
    raid_damage_ticket: { maxPerGrant: RAID_MAX_PER_GRANT, dailyTickets: RAID_DAILY_TICKETS, label: 'raid damage' },
};

function offsetDay(nowMs) {
    const shifted = new Date((nowMs == null ? Date.now() : nowMs) - RESET_HOUR_UTC * 3600 * 1000);
    return shifted.toISOString().split('T')[0];
}

function get(action) {
    return ACTIONS[action] || null;
}

function claimId(action, day, nonce) {
    const spec = ACTIONS[action];
    if (!spec) return '';
    if (spec.once) return 'once_' + action;
    if (nonce) return day + '_' + action + '_' + nonce;
    return day + '_' + action;
}

function amountFor(action, requested) {
    const spec = ACTIONS[action];
    if (!spec) return 0;
    if (spec.tickets) return spec.tickets;
    const n = Math.floor(Number(requested) || 0);
    if (n <= 0) return 0;
    return Math.min(spec.maxPerGrant || n, n);
}

function raidTickets(damage) {
    const n = Number(damage);
    if (!(n > 0)) return 0;
    const whole = Math.floor(n);
    return Math.min(RAID_MAX_PER_GRANT, whole > 0 ? whole : 1);
}

// Daily ticket total, not a per-call count. A 250 XP day or 240 watch
// minutes still stops at 10. `usedToday` is the tickets field on the raid count doc.
function planRaidTickets(damage, usedToday) {
    const want = raidTickets(damage);
    const used = Math.max(0, Math.floor(Number(usedToday) || 0));
    const room = Math.max(0, RAID_DAILY_TICKETS - used);
    return Math.min(want, room);
}

function stravaAthleteKey(athleteId) {
    return String(athleteId == null ? '' : athleteId).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
}

function stravaTicketAllowed(athleteClaimed, userClaimed, athleteId) {
    return !!stravaAthleteKey(athleteId) && !athleteClaimed && !userClaimed;
}

function doubleXpActive(expiry, nowMs) {
    if (!expiry) return false;
    const now = nowMs == null ? Date.now() : nowMs;
    let ms = 0;
    if (typeof expiry.toMillis === 'function') ms = expiry.toMillis();
    else if (typeof expiry === 'number') ms = expiry;
    else if (typeof expiry.seconds === 'number') ms = expiry.seconds * 1000;
    return ms > now;
}

// Tickets awardPoints may add after it has already decided the XP grant.
// tctv: 1 on a watch block that paid XP, once per day.
// trifecta: 1 when this grant completes quiz + trivia + poll for the day.
function bonusTickets(actionId, awarded, proofs) {
    const src = proofs || {};
    const kinds = [];
    if (actionId === 'tctv_watch_10m' && awarded > 0 && !src.tctvClaimed) {
        kinds.push('tctv_watch_ticket');
    }
    const finishesSet = awarded > 0 && (
        actionId === 'quiz_correct' ||
        actionId === 'trivia_correct' ||
        actionId === 'trivia_attempt' ||
        actionId === 'poll_vote'
    );
    if (finishesSet && !src.trifectaClaimed) {
        const quiz = actionId === 'quiz_correct' || !!src.quiz;
        const trivia = actionId === 'trivia_correct' || actionId === 'trivia_attempt' || !!src.trivia;
        const poll = actionId === 'poll_vote' || !!src.poll;
        if (quiz && trivia && poll) kinds.push('daily_trifecta_ticket');
    }
    let tickets = 0;
    kinds.forEach(function(kind) { tickets += ACTIONS[kind].tickets; });
    return { tickets: tickets, kinds: kinds };
}

module.exports = {
    ACTIONS: ACTIONS,
    RAID_MAX_PER_GRANT: RAID_MAX_PER_GRANT,
    RAID_DAILY_TICKETS: RAID_DAILY_TICKETS,
    offsetDay: offsetDay,
    get: get,
    claimId: claimId,
    amountFor: amountFor,
    raidTickets: raidTickets,
    planRaidTickets: planRaidTickets,
    stravaAthleteKey: stravaAthleteKey,
    stravaTicketAllowed: stravaTicketAllowed,
    doubleXpActive: doubleXpActive,
    bonusTickets: bonusTickets,
};
