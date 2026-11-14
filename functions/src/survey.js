'use strict';

// In-app feedback survey (Citadel Spark survey, approved by Phil Nov 13-14,
// 2026). Questions come from Rebrand Plan's list in the Citadel Spark Team
// room (Nov 14, 11:41 AM ET) with Q7 (the rename question) removed per Phil,
// so 11 questions. Lapsed players (no visit in 90 days) get Q1, Q3, Q8, Q12
// plus "What made you stop?". Ids keep Rebrand Plan's numbering (no q7) so
// results map back to the plan.
//
// Reward: 25 OrangeTix, once per uid, granted server-side on submit.
//   * survey_responses/{uid} is create-only and is the idempotency key.
//   * users/{uid}/award_claims/once_survey_<id> is written in the same
//     transaction, so a second submit (or a race) writes nothing.
//   * survey_audit gets one append-only row per grant.
// Closing: the survey closes when the kill switch flips, not on a date.
//   * submitSurvey is in killSwitch GATED.rewards, so it refuses while the
//     switch is on.
//   * It also stays closed after the app comes back: if config/killSwitch
//     `since` (the last time it was turned on) is later than the survey's
//     openedAt, the survey is over. config/survey { closed: true } closes it
//     by hand.
// Eligibility (Red Team, Nov 14): only accounts created before openedAt
// (config/survey.openedAt, else OPENED_AT_DEFAULT_MS) get the OrangeTix, so
// scripted sign-ups cannot farm Nook raffle entries. Merged, deleted and
// disabled accounts get no grant either, and so does any uid whose verified
// email or sign-in provider matches a deleted_accounts tombstone (a deleted
// and re-created account). If the tombstone secret is missing the grant
// fails closed (answers saved, 0 tickets). Ineligible accounts still have their
// answers saved and get { granted: false, reason } with 0 tickets.
// Reads: survey_responses and survey_audit are admin-only in rules.
// The free-text answers (q3, q5, q12, stop) are player-controlled. Any future
// admin view of them must render them as plain text only (textContent, never
// innerHTML or a markdown/HTML renderer).

const SURVEY_ID = 'citadel_spark_2026';
const REWARD_TICKETS = 25;
// Any kill-switch flip after this moment closes the survey for good.
// config/survey.openedAt (admin-written) overrides it, e.g. on staging.
const OPENED_AT_DEFAULT_MS = Date.parse('2026-11-14T18:00:00Z');
const LAPSED_DAYS = 90;
const MAX_TEXT = 1000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 10;
const CLAIM_ID = 'once_survey_' + SURVEY_ID;
const USER_DONE_FIELD = 'surveyDone_' + SURVEY_ID;
const CLOSED_MESSAGE = 'The survey is closed. Thanks for playing!';

const QUESTIONS = Object.freeze([
    { id: 'q1', type: 'single', required: true, options: ['friend', 'x', 'youtube', 'search', 'meetup', 'school', 'other'] },
    { id: 'q2', type: 'multi', options: ['lessons', 'quests', 'rewards', 'nook', 'ciphers', 'chat', 'other'] },
    { id: 'q3', type: 'text' },
    { id: 'q4', type: 'scale', min: 1, max: 5 },
    { id: 'q5', type: 'text' },
    { id: 'q6', type: 'scale', min: 1, max: 5 },
    { id: 'q8', type: 'single', options: ['yes', 'maybe', 'no'] },
    { id: 'q9', type: 'single', options: ['building', 'defending', 'raiding', 'decorating'] },
    { id: 'q10', type: 'multi', options: ['cosmetics', 'build_space', 'rewards_limit', 'none'], exclusive: 'none' },
    { id: 'q11', type: 'scale', min: 0, max: 10 },
    { id: 'q12', type: 'text' },
    { id: 'stop', type: 'text' },
]);

const VARIANTS = Object.freeze({
    full: Object.freeze(['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q8', 'q9', 'q10', 'q11', 'q12']),
    lapsed: Object.freeze(['q1', 'q3', 'q8', 'q12', 'stop']),
});

function byId(id) {
    for (let i = 0; i < QUESTIONS.length; i++) if (QUESTIONS[i].id === id) return QUESTIONS[i];
    return null;
}

function cleanText(raw) {
    if (typeof raw !== 'string') return null;
    // Drop control characters and angle brackets so no markup reaches an
    // admin view, then collapse runs of blank space.
    let s = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F<>]/g, '');
    s = s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (s.length > MAX_TEXT) return { tooLong: true };
    return s;
}

// Returns { ok: true, variant, answers } or { ok: false, why }.
function validate(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, why: 'bad_payload' };
    if (data.surveyId !== SURVEY_ID) return { ok: false, why: 'bad_survey' };
    const variant = data.variant;
    if (typeof variant !== 'string' || !Object.prototype.hasOwnProperty.call(VARIANTS, variant)) return { ok: false, why: 'bad_variant' };
    const allowed = VARIANTS[variant];
    const answers = data.answers;
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return { ok: false, why: 'bad_answers' };
    const keys = Object.keys(answers);
    if (keys.length > allowed.length) return { ok: false, why: 'too_many' };
    const out = {};
    for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (allowed.indexOf(k) === -1) return { ok: false, why: 'unknown_question' };
        const q = byId(k);
        const v = answers[k];
        if (v === null || v === undefined || v === '') continue;
        if (q.type === 'single') {
            if (typeof v !== 'string' || q.options.indexOf(v) === -1) return { ok: false, why: 'bad_option' };
            out[k] = v;
        } else if (q.type === 'multi') {
            if (!Array.isArray(v) || v.length > q.options.length) return { ok: false, why: 'bad_multi' };
            const seen = {};
            const picked = [];
            for (let j = 0; j < v.length; j++) {
                if (typeof v[j] !== 'string' || q.options.indexOf(v[j]) === -1) return { ok: false, why: 'bad_option' };
                if (seen[v[j]]) return { ok: false, why: 'dup_option' };
                seen[v[j]] = true;
                picked.push(v[j]);
            }
            if (q.exclusive && seen[q.exclusive] && picked.length > 1) return { ok: false, why: 'exclusive_option' };
            if (picked.length) out[k] = picked;
        } else if (q.type === 'scale') {
            if (typeof v !== 'number' || !Number.isInteger(v) || v < q.min || v > q.max) return { ok: false, why: 'bad_scale' };
            out[k] = v;
        } else if (q.type === 'text') {
            const s = cleanText(v);
            if (s === null) return { ok: false, why: 'bad_text' };
            if (s.tooLong) return { ok: false, why: 'text_too_long' };
            if (s) out[k] = s;
        }
    }
    for (let i = 0; i < allowed.length; i++) {
        const q = byId(allowed[i]);
        if (q.required && out[q.id] === undefined) return { ok: false, why: 'missing_required' };
    }
    return { ok: true, variant: variant, answers: out };
}

function toMillis(v) {
    if (!v) return null;
    if (typeof v === 'number') return v;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v.seconds === 'number') return v.seconds * 1000;
    if (v instanceof Date) return v.getTime();
    return null;
}

// Pure: is the survey closed, given config/killSwitch and config/survey?
function closedReason(ksData, surveyCfg, nowMs) {
    const cfg = surveyCfg || {};
    if (cfg.closed === true) return 'closed_by_admin';
    const openedAt = toMillis(cfg.openedAt) || OPENED_AT_DEFAULT_MS;
    if (ksData && ksData.enabled === true) {
        const until = toMillis(ksData.autoReenableAt);
        if (!until || nowMs < until) return 'kill_switch_on';
    }
    const since = ksData ? toMillis(ksData.since) : null;
    if (since && since > openedAt) return 'kill_switch_flipped';
    return null;
}

function maskUid(uid) {
    const s = String(uid || '');
    return s.length <= 6 ? '***' : s.slice(0, 3) + '***' + s.slice(-3);
}

// Why an account gets no OrangeTix, or '' when it is eligible. authUser is
// the Auth record (null when it no longer exists); user is users/{uid}.
// tomb is the accountTombstone.lookupByMaterials result.
function grantBlockReason(authUser, user, openedAtMs, tomb) {
    if (!authUser) return 'account_deleted';
    if (authUser.disabled === true) return 'account_disabled';
    const u = user || {};
    if (u.mergedInto) return 'account_merged';
    if (u.deleted === true || (u.deletedAt != null && u.deletedAt !== '')) return 'account_deleted';
    if (u.disabled === true) return 'account_disabled';
    const created = Date.parse(((authUser.metadata || {}).creationTime) || '') || 0;
    if (!created || created >= openedAtMs) return 'account_too_new';
    if (!tomb || tomb.configured !== true) return 'identity_check_unavailable';
    if (Array.isArray(tomb.docs) && tomb.docs.length) return 'account_recreated';
    return '';
}

function openedAtFrom(cfg) {
    return toMillis(cfg && cfg.openedAt) || OPENED_AT_DEFAULT_MS;
}

function makeSubmitSurvey(deps) {
    const functionsV1 = deps.functionsV1;
    const admin = deps.admin;
    const getDb = deps.getDb;
    const now = deps.now || Date.now;
    const getAuth = deps.getAuth || function () { return admin.auth(); };
    const tombstone = deps.tombstone || require('./accountTombstone');
    const HttpsError = functionsV1.https.HttpsError;
    const runWith = Object.assign({}, deps.runWith || {});
    // index.js passes the App Check flag so the scanner in
    // tests/test-app-check-callables.js sees submitSurvey. Refuse to build
    // the callable without it.
    if (runWith.enforceAppCheck !== true) throw new Error('submitSurvey must enforce App Check');

    async function handler(data, context) {
        if (!context || !context.auth) throw new HttpsError('unauthenticated', 'Sign in to take the survey.');
        const provider = ((context.auth.token || {}).firebase || {}).sign_in_provider || '';
        if (provider === 'anonymous') throw new HttpsError('permission-denied', 'Sign in to take the survey.');
        if (!context.app) throw new HttpsError('failed-precondition', 'Security check did not load. Refresh the page and try again.');
        const uid = context.auth.uid;
        const db = getDb();
        const FieldValue = admin.firestore.FieldValue;
        const Timestamp = admin.firestore.Timestamp;
        const nowMs = now();

        // 1. Rate limit before any per-submit work.
        const rateRef = db.collection('rate_limits').doc('survey_' + uid);
        await db.runTransaction(async function (tx) {
            const snap = await tx.get(rateRef);
            const d = snap.exists ? (snap.data() || {}) : {};
            const start = toMillis(d.windowStart) || 0;
            if (snap.exists && nowMs - start < RATE_WINDOW_MS) {
                if ((d.count || 0) >= RATE_MAX) throw new HttpsError('resource-exhausted', 'Too many tries. Wait a few minutes and try again.');
                tx.update(rateRef, { count: (d.count || 0) + 1 });
            } else {
                tx.set(rateRef, {
                    windowStart: Timestamp.fromMillis(nowMs),
                    count: 1,
                    expireAt: Timestamp.fromMillis(nowMs + RATE_WINDOW_MS),
                });
            }
        });

        // 2. Validate.
        const v = validate(data);
        if (!v.ok) throw new HttpsError('invalid-argument', 'Some answers could not be saved. Check them and try again.', { why: v.why });

        // 3. Auth record for account age and disabled state.
        let authUser = null;
        try {
            authUser = await getAuth().getUser(uid);
        } catch (err) {
            const code = String((err && (err.code || (err.errorInfo && err.errorInfo.code))) || '');
            if (code.indexOf('user-not-found') === -1) throw err;
        }
        // Same identity lookup account deletion and payouts use.
        let tomb = null;
        if (authUser) {
            const identity = tombstone.identityFrom({ uid: uid, authUser: authUser, token: context.auth.token || {} });
            tomb = await tombstone.lookupByMaterials(db, identity);
        }

        // 4. One transaction: closed check, ban check, once-per-uid grant.
        const ksRef = db.collection('config').doc('killSwitch');
        const cfgRef = db.collection('config').doc('survey');
        const userRef = db.collection('users').doc(uid);
        const respRef = db.collection('survey_responses').doc(uid);
        const claimRef = userRef.collection('award_claims').doc(CLAIM_ID);
        const auditRef = db.collection('survey_audit').doc();

        return db.runTransaction(async function (tx) {
            const ksSnap = await tx.get(ksRef);
            const cfgSnap = await tx.get(cfgRef);
            const userSnap = await tx.get(userRef);
            const respSnap = await tx.get(respRef);
            const claimSnap = await tx.get(claimRef);
            const why = closedReason(ksSnap.exists ? ksSnap.data() : null, cfgSnap.exists ? cfgSnap.data() : null, nowMs);
            if (why) throw new HttpsError('failed-precondition', CLOSED_MESSAGE, { why: why });
            if (!userSnap.exists) throw new HttpsError('failed-precondition', 'Finish setting up your account first.');
            const user = userSnap.data() || {};
            if (user.ban_reason || user.banned === true) throw new HttpsError('permission-denied', 'This account cannot take the survey.');
            if (respSnap.exists || claimSnap.exists) {
                return { ok: true, already: true, granted: claimSnap.exists, tickets: 0 };
            }
            const blocked = grantBlockReason(authUser, user, openedAtFrom(cfgSnap.exists ? cfgSnap.data() : null), tomb);
            const ts = FieldValue.serverTimestamp();
            tx.create(respRef, {
                uid: uid,
                surveyId: SURVEY_ID,
                variant: v.variant,
                answers: v.answers,
                granted: !blocked,
                noGrantReason: blocked || null,
                createdAt: ts,
            });
            if (blocked) {
                const doneOnly = {};
                doneOnly[USER_DONE_FIELD] = ts;
                tx.update(userRef, doneOnly);
                tx.create(auditRef, {
                    action: 'survey_response_no_grant',
                    surveyId: SURVEY_ID,
                    uidMasked: maskUid(uid),
                    variant: v.variant,
                    reason: blocked,
                    tickets: 0,
                    at: ts,
                });
                return { ok: true, already: false, granted: false, reason: blocked, tickets: 0 };
            }
            tx.create(claimRef, {
                action: 'survey_' + SURVEY_ID,
                tickets: REWARD_TICKETS,
                at: ts,
            });
            const userWrite = { orangeTickets: FieldValue.increment(REWARD_TICKETS) };
            userWrite[USER_DONE_FIELD] = ts;
            tx.update(userRef, userWrite);
            tx.create(auditRef, {
                action: 'survey_reward_granted',
                surveyId: SURVEY_ID,
                uidMasked: maskUid(uid),
                variant: v.variant,
                tickets: REWARD_TICKETS,
                at: ts,
            });
            return { ok: true, already: false, granted: true, tickets: REWARD_TICKETS };
        });
    }

    const fn = functionsV1.runWith(runWith).https.onCall(handler);
    Object.defineProperty(fn, '__surveyHandler', { value: handler, enumerable: false });
    return fn;
}

module.exports = {
    SURVEY_ID: SURVEY_ID,
    REWARD_TICKETS: REWARD_TICKETS,
    OPENED_AT_DEFAULT_MS: OPENED_AT_DEFAULT_MS,
    LAPSED_DAYS: LAPSED_DAYS,
    MAX_TEXT: MAX_TEXT,
    RATE_MAX: RATE_MAX,
    RATE_WINDOW_MS: RATE_WINDOW_MS,
    CLAIM_ID: CLAIM_ID,
    USER_DONE_FIELD: USER_DONE_FIELD,
    CLOSED_MESSAGE: CLOSED_MESSAGE,
    QUESTIONS: QUESTIONS,
    VARIANTS: VARIANTS,
    validate: validate,
    closedReason: closedReason,
    grantBlockReason: grantBlockReason,
    openedAtFrom: openedAtFrom,
    maskUid: maskUid,
    makeSubmitSurvey: makeSubmitSurvey,
};
