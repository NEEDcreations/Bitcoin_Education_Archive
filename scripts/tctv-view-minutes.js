'use strict';

// Pure checks for Timechain TV view minutes vs the pot of sats ledger.
// No Firestore here. The audit script only reads. The credit script is a
// dry-run until --apply, and it only adds missed pot seconds. It never
// touches a sats balance: the pot pays from these seconds when it fills.

const { offsetDateKey } = require('../functions/src/offsetDay');
const { isAgentOrBlocked, DEFAULTS } = require('../functions/src/tctvDripLogic');

const CREDIT_SECONDS = 60;
const CLAIM_SECONDS = 600;
const DEFAULT_DAYS = 7;

function floorSeconds(value) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function dayKeyFromMs(ms) {
    return offsetDateKey(ms);
}

// day is YYYY-MM-DD. delta is a whole number of calendar days.
function shiftDay(day, delta) {
    const ms = Date.parse(String(day) + 'T00:00:00Z');
    if (!Number.isFinite(ms)) return '';
    return new Date(ms + delta * 86400000).toISOString().slice(0, 10);
}

function windowStartDay(today, days) {
    const n = Math.max(1, Math.floor(Number(days) || DEFAULT_DAYS));
    return shiftDay(today, -(n - 1));
}

function potIsOpen(status) {
    return status === 'filling' || status === 'full' || status === 'held';
}

// Prompt still open and the last check-in is at or after the moment it came due.
// Minutes inside that span were not credited: raising the prompt used to move
// lastCheckMs, so the tap was rejected as too-fast and seconds stayed put.
function promptStuckState(drip, nowMs) {
    const doc = drip || {};
    const token = typeof doc.promptToken === 'string' ? doc.promptToken : '';
    const due = floorSeconds(doc.promptDueMs) ? Number(doc.promptDueMs) : 0;
    const last = Number(doc.lastCheckMs);
    const now = Number(nowMs);
    const stuck = !!(token && due > 0 && Number.isFinite(last) && last >= due);
    const end = Number.isFinite(now) ? Math.min(last, now) : last;
    const stuckCredit = stuck ? Math.floor((end - due) / 1000 / 60) * CREDIT_SECONDS : 0;
    return { stuck: stuck, stuckCreditSeconds: Math.max(0, stuckCredit) };
}

// Independent evidence that this person was actually watching.
// Today uses the daily ledger and, when it is ahead, the lifetime-today counter
// (the daily goal stops at 10 minutes; lifetime keeps going).
// Earlier days only count a finished daily goal (one ticket claim = 10 minutes).
// That is a lower bound. Presence rows are gone after a few minutes, so this
// cannot rebuild a minute-by-minute log.
function verifiedWatchSeconds(input) {
    const src = input || {};
    const today = String(src.today || '');
    const daily = src.daily || {};
    const claims = Array.isArray(src.claims) ? src.claims : [];
    const potDay = src.potCreatedMs ? dayKeyFromMs(src.potCreatedMs) : '';
    const windowStart = String(src.windowStart || '');
    let todayVerified = 0;
    if (daily.lifeDay === today) todayVerified = Math.max(todayVerified, floorSeconds(daily.lifeDaySeconds));
    if (daily.day === today) todayVerified = Math.max(todayVerified, floorSeconds(daily.seconds));
    let past = 0;
    let todayClaim = false;
    const seen = new Set();
    for (let i = 0; i < claims.length; i++) {
        const claim = claims[i] || {};
        const day = typeof claim.day === 'string' ? claim.day : '';
        if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(day) || seen.has(day)) continue;
        if (potDay && day < potDay) continue;
        if (windowStart && day < windowStart) continue;
        seen.add(day);
        if (day === today) todayClaim = true;
        else past += CLAIM_SECONDS;
    }
    if (todayClaim) todayVerified = Math.max(todayVerified, CLAIM_SECONDS);
    return {
        verified: past + todayVerified,
        todayVerified: todayVerified,
        pastClaimSeconds: past,
        claimDays: seen.size,
    };
}

// owedSeconds is what the credit script would add, and only for an open pot,
// an age-ok account, and a prompt that is still swallowing minutes while the
// watch ledger shows those minutes happened. gapSeconds is the wider shortfall
// (watch ledger ahead of the pot) and is listed, not applied, when the prompt
// evidence is missing.
function assessPotCredit(row) {
    const src = row || {};
    const uid = String(src.uid || '');
    const potSeconds = floorSeconds(src.potSeconds);
    const cap = Math.max(CREDIT_SECONDS, floorSeconds(src.perAccountLimitSeconds) || DEFAULTS.perAccountLimitSeconds);
    const room = Math.max(0, cap - potSeconds);
    const verified = floorSeconds(src.verifiedSeconds);
    const gap = Math.max(0, verified - potSeconds);
    const stuck = src.promptStuck === true;
    const stuckCredit = floorSeconds(src.stuckCreditSeconds);
    const ageOk = src.ageOk === true;
    const blocked = src.blocked === true;
    const open = src.potOpen === true;
    let owed = 0;
    let reason = 'ok';
    if (!uid) reason = 'no-uid';
    else if (!open) reason = 'pot-closed';
    else if (blocked) reason = 'ineligible';
    else if (!ageOk) reason = 'age-ineligible';
    else if (src.hasDripDoc === false) reason = 'no-drip-doc';
    else if (stuck && gap >= CREDIT_SECONDS && stuckCredit >= CREDIT_SECONDS && room >= CREDIT_SECONDS) {
        owed = Math.floor(Math.min(gap, stuckCredit, room) / CREDIT_SECONDS) * CREDIT_SECONDS;
        reason = owed > 0 ? 'prompt-loop-while-watching' : 'ok';
    } else if (gap >= CREDIT_SECONDS) reason = 'watch-ledger-ahead';
    const accurate = reason === 'ok' || reason === 'pot-closed';
    return {
        uid: uid,
        potSeconds: potSeconds,
        verifiedSeconds: verified,
        gapSeconds: gap,
        gapMinutes: Math.floor(gap / 60),
        owedSeconds: owed,
        owedMinutes: owed / 60,
        reason: reason,
        promptStuck: stuck,
        accurate: accurate,
        willCredit: owed > 0 && reason === 'prompt-loop-while-watching',
    };
}

function creditMode(argv) {
    return (argv || []).indexOf('--apply') !== -1 ? 'apply' : 'dry-run';
}

function auditRejectsApply(argv) {
    return (argv || []).indexOf('--apply') !== -1;
}

function daysArg(argv) {
    const list = argv || [];
    const idx = list.indexOf('--days');
    if (idx === -1) return DEFAULT_DAYS;
    const n = Math.floor(Number(list[idx + 1]));
    if (!Number.isFinite(n) || n < 1 || n > 60) return DEFAULT_DAYS;
    return n;
}

// Fields merged onto the watch doc. secondsDelta is added to the stored
// seconds inside the transaction. promptDueMs moves forward so the next
// check-in is not immediately stuck on a new prompt.
function creditPatch(owedSeconds, nowMs) {
    const add = Math.floor(Number(owedSeconds) / CREDIT_SECONDS) * CREDIT_SECONDS;
    const now = Math.floor(Number(nowMs));
    return {
        secondsDelta: add > 0 ? add : 0,
        promptToken: '',
        promptDueMs: now + 20 * 60 * 1000,
        viewMinuteCreditReason: 'prompt-loop-while-watching',
    };
}

function userIsBlocked(user) {
    return isAgentOrBlocked(user);
}

module.exports = {
    CREDIT_SECONDS: CREDIT_SECONDS,
    CLAIM_SECONDS: CLAIM_SECONDS,
    DEFAULT_DAYS: DEFAULT_DAYS,
    floorSeconds: floorSeconds,
    dayKeyFromMs: dayKeyFromMs,
    shiftDay: shiftDay,
    windowStartDay: windowStartDay,
    potIsOpen: potIsOpen,
    promptStuckState: promptStuckState,
    verifiedWatchSeconds: verifiedWatchSeconds,
    assessPotCredit: assessPotCredit,
    creditMode: creditMode,
    auditRejectsApply: auditRejectsApply,
    daysArg: daysArg,
    creditPatch: creditPatch,
    userIsBlocked: userIsBlocked,
};
