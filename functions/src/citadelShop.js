'use strict';

// Citadel shop server logic (client: citadel-shop.js). Pure core with injected
// deps so it can be tested without Firebase. Wiring is in citadelShopFns.js.
//
// The server is the only authority for Premium, prices, stage order, the
// weekly OrangeTix cap, balance, account age, guests, the referral-week flag
// and the kill switch. The client sends ids only, never prices.
//
// Collections (Admin SDK writes only; rules deny all client access):
//   citadel_weekly/{uid}_{weekKey}      weekly spend counter, expireAt = week end + 14 days
//   citadel_purchases/{uid}_{requestId} one row per buy or build, kept 13 months
// Player state lives on users/{uid}.citadel:
//   ownedStages { partId: n }  paid stages collected (bought), 0..part.stages
//   stages      { partId: n }  paid stages built, always <= ownedStages
//   lessonParts { id: true }   lesson parts collected (earned)
//   lessonBuilt { id: true }   lesson parts built
// Buying only collects. Building is a separate step (buildCitadelPart) behind
// config/citadelShop.buildOpen, so a build timer can attach there later.
// Docs written before ownedStages existed count every built stage as owned.

const { rewardBlocked } = require('./cipherClaim');

const WEEKLY_CAP_OT = 120;
// TODO(phil): minimum account age in days to buy parts (spec question 6).
const MIN_ACCOUNT_AGE_DAYS = 7;
// TODO(phil): can a Premium trial buy parts? false follows the Rewards
// recommendation (same as Embers). Trials start about a month after Jan 3.
const TRIAL_CAN_BUY = false;
// TODO(phil): OrangeTix earned before Jan 3, 2027 spendable on parts. true
// matches the Rewards recommendation; false would need an earn-date ledger,
// which does not exist, so false is not implemented.
const PRE_JAN3_OT_SPENDABLE = true;
// Citadel opens with Premium perks: Jan 3, 2027 12:00 AM ET. Staging may open
// early with config/citadelShop.openEarly === true (ignored on live).
// Building is separate: it opens only when config/citadelShop.buildOpen === true
// (missing or anything else means closed, on staging and live). openEarly
// never opens building (Phil, Nov 18: collect from Jan 3, build later).
const OPENS_AT_MS = Date.UTC(2027, 0, 3, 5, 0, 0);
const COUNTER_KEEP_DAYS = 14;
const PURCHASE_KEEP_MONTHS = 13;
const DAY_MS = 86400000;

// Draft catalog (Rewards draft, Nov 19, 2026). Source of truth for prices.
const PARTS = Object.freeze({
    walls: { stages: 4, price: 75 },
    turret: { stages: 2, price: 100 },
    vault: { stages: 2, price: 120 },
    tower: { stages: 3, price: 100 },
    keep: { stages: 4, price: 115 },
});

// Decided by team for now (Phil, Nov 19); change freely. Same ids as the
// client CONFIG.LESSON_PART_MAP. lesson = users/{uid}.lqPassed id.
const LESSON_PART_MAP = Object.freeze({
    lesson_walls: { part: 'walls', lesson: 'lq_what_is_bitcoin' },
    lesson_keep: { part: 'keep', lesson: 'lq_mining' },
    lesson_tower: { part: 'tower', lesson: 'lq_nodes' },
    lesson_vault: { part: 'vault', lesson: 'lq_self_custody' },
    lesson_turret: { part: 'turret', lesson: 'lq_lightning' },
});

const MESSAGES = {
    unauthenticated: 'Sign in to use the Citadel shop.',
    guest: 'Sign in with an account to use the Citadel shop.',
    kill_switch: 'Bitcoin Quest is offline for maintenance. Please try again later.',
    not_open: 'The Citadel opens January 3, 2027 at 12:00 AM ET.',
    not_build_open: 'Building opens later.',
    bad_request: 'That request is not valid.',
    not_premium: 'Buying and building parts needs Premium.',
    trial: 'Parts can be bought once your paid Premium starts.',
    flag_off: 'Referral-week Premium cannot buy parts right now.',
    account_age: 'Parts buying opens when your account is ' + MIN_ACCOUNT_AGE_DAYS + ' days old.',
    no_profile: 'Profile not found.',
    already_owned: 'That part is already complete.',
    wrong_stage: 'That stage is not next. Refresh the shop and try again.',
    weekly_cap: 'That would go over this week\u2019s ' + WEEKLY_CAP_OT + ' OrangeTix limit for parts.',
    balance: 'Not enough OrangeTix.',
    not_owned: 'You have not earned that lesson part yet.',
    not_collected: 'Collect that part before building it.',
    already_built: 'That part is already built.',
    banned: 'This account cannot use the Citadel shop.',
};

function fail(code) { return { success: false, code: code, message: MESSAGES[code] || 'Something went wrong.' }; }

// A requestId replay returns the first result only to the uid that made it.
// Doc ids are uid + '_' + requestId, so a row owned by another uid (an id
// collision) is refused instead of leaking that player's result.
// kind ('stage' or 'build') keeps a buy requestId from replaying as a build.
function replayOf(row, uid, kind) {
    const d = row || {};
    if (d.uid !== uid || !d.result) return fail('bad_request');
    if (kind && d.kind !== kind) return fail('bad_request');
    return Object.assign({ repeat: true }, d.result);
}

function maskUid(uid) {
    const s = String(uid || '');
    if (s.length <= 4) return '\u2026';
    return s.slice(0, 2) + '\u2026' + s.slice(-2);
}

function cleanRequestId(v) {
    return typeof v === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(v) ? v : null;
}

// ---- Week in America/New_York (Monday 00:00 ET to next Monday 00:00 ET) ----
function etParts(ms) {
    const f = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', hourCycle: 'h23', weekday: 'short',
    });
    const o = {};
    f.formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = p.value; });
    const wd = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[o.weekday];
    return { y: Number(o.year), m: Number(o.month), d: Number(o.day), h: Number(o.hour), wd: wd };
}
function etMidnightMs(y, m, d) {
    for (const off of [5, 4]) {
        const ms = Date.UTC(y, m - 1, d, off);
        const p = etParts(ms);
        if (p.h === 0 && p.d === new Date(Date.UTC(y, m - 1, d)).getUTCDate()) return ms;
    }
    return Date.UTC(y, m - 1, d, 5);
}
function etDateKey(ms) {
    const p = etParts(ms);
    function pad(n) { return String(n).padStart(2, '0'); }
    return String(p.y) + '-' + pad(p.m) + '-' + pad(p.d);
}

// Optional firstWindowEndMs (config/citadelShop.firstWindowEndMs) stretches the
// first shop window so a Sunday open (Jan 3, 2027) can run through a later
// reset. Unset, 0, or a non-number leaves the Monday-week behavior unchanged.
function weekInfo(nowMs, firstWindowEndMs) {
    const firstEnd = Number(firstWindowEndMs);
    if (Number.isFinite(firstEnd) && firstEnd > OPENS_AT_MS && nowMs < firstEnd) {
        return { key: etDateKey(OPENS_AT_MS), endMs: firstEnd };
    }
    const p = etParts(nowMs);
    const mon = new Date(Date.UTC(p.y, p.m - 1, p.d - p.wd));
    const next = new Date(Date.UTC(p.y, p.m - 1, p.d - p.wd + 7));
    const key = mon.toISOString().slice(0, 10);
    const endMs = etMidnightMs(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
    return { key: key, endMs: endMs };
}

function tooYoung(createdMs, nowMs) {
    return MIN_ACCOUNT_AGE_DAYS > 0 && !(Number.isFinite(createdMs) && nowMs - createdMs >= MIN_ACCOUNT_AGE_DAYS * DAY_MS);
}

function purchaseMeta(nowMs) {
    const retainUntilMs = addMonths(nowMs, PURCHASE_KEEP_MONTHS);
    return { createdAtMs: nowMs, retainUntilMs: retainUntilMs, expireAt: new Date(retainUntilMs) };
}

function addMonths(ms, n) {
    const d = new Date(ms);
    d.setUTCMonth(d.getUTCMonth() + n);
    return d.getTime();
}

// ---- Premium (same rules as #322 premium.js summarize) ----
// Used only when ./premium is not in the build. premium_entitlements/{uid}.
function premiumSummaryLocal(ent, nowMs) {
    const e = ent || {};
    const founders = e.founders === true;
    const until = Math.max(Number(e.subscriptionUntilMs) || 0, Number(e.prepaidUntilMs) || 0);
    const covered = e.revoked !== true && e.frozen !== true && (founders || until > nowMs);
    const startsAt = Number(e.startsAtMs) || 0;
    const active = covered && (!startsAt || nowMs >= startsAt);
    const trialUntil = Number(e.trialUntilMs) || 0;
    const referralUntil = Number(e.referralWeekUntilMs) || 0;
    return {
        active: active,
        inTrial: active && trialUntil > nowMs,
        inReferralWeek: e.referralWeek === true || referralUntil > nowMs,
    };
}

function cleanMap(m) { return m && typeof m === 'object' ? m : {}; }

function clampStage(v, id) {
    const n = Math.floor(Number(v) || 0);
    return Math.max(0, Math.min(n, PARTS[id].stages));
}

function stateFrom(user) {
    const c = cleanMap(user && user.citadel);
    const stages = {};
    const ownedStages = {};
    Object.keys(PARTS).forEach(function (id) {
        stages[id] = clampStage(cleanMap(c.stages)[id], id);
        ownedStages[id] = Math.max(stages[id], clampStage(cleanMap(c.ownedStages)[id], id));
    });
    const lessonParts = {};
    const lessonBuilt = {};
    Object.keys(LESSON_PART_MAP).forEach(function (id) {
        if (cleanMap(c.lessonParts)[id] === true) lessonParts[id] = true;
        if (cleanMap(c.lessonBuilt)[id] === true) lessonBuilt[id] = true;
    });
    return { stages: stages, ownedStages: ownedStages, lessonParts: lessonParts, lessonBuilt: lessonBuilt };
}

// Per-part summary for the status call: collected, built, total.
function partsSummary(st) {
    const out = {};
    Object.keys(PARTS).forEach(function (id) {
        out[id] = { owned: st.ownedStages[id], built: st.stages[id], total: PARTS[id].stages };
    });
    return out;
}

function pendingLessons(user) {
    const passed = Array.isArray(user && user.lqPassed) ? user.lqPassed : [];
    const have = stateFrom(user).lessonParts;
    return Object.keys(LESSON_PART_MAP).filter(function (id) {
        return !have[id] && passed.indexOf(LESSON_PART_MAP[id].lesson) !== -1;
    });
}

// deps: db, nowMs(), isOffline(), isGuest(context), accountCreatedMs(uid),
//       premiumSummary(ent, nowMs), isStaging(), log(msg)
function createCitadelShopService(deps) {
    const db = deps.db;
    const now = deps.nowMs || Date.now;
    const log = deps.log || function () {};
    const summary = deps.premiumSummary || premiumSummaryLocal;

    function refs(uid, requestId, weekKey) {
        return {
            user: db.collection('users').doc(uid),
            ent: db.collection('premium_entitlements').doc(uid),
            week: db.collection('citadel_weekly').doc(uid + '_' + weekKey),
            op: requestId ? db.collection('citadel_purchases').doc(uid + '_' + requestId) : null,
            ledger: db.collection('faucet_ledger').doc(uid),
        };
    }

    async function readFlags() {
        const snap = await db.collection('config').doc('citadelShop').get();
        const d = snap.exists ? (snap.data() || {}) : {};
        const firstEnd = Number(d.firstWindowEndMs);
        return {
            referralWeekPremiumBuy: d.referralWeekPremiumBuy === true,
            openEarly: d.openEarly === true && !!(deps.isStaging && deps.isStaging()),
            firstWindowEndMs: Number.isFinite(firstEnd) && firstEnd > 0 ? firstEnd : undefined,
            // Fail closed: only a literal true opens building. Not tied to
            // openEarly or the Jan 3 open time.
            buildOpen: d.buildOpen === true,
        };
    }

    function isOpen(flags, nowMs) { return nowMs >= OPENS_AT_MS || flags.openEarly === true; }
    function isBuildOpen(flags) { return !!flags && flags.buildOpen === true; }

    // Shared gates before any write. Returns a fail() or null.
    async function gate(context) {
        if (!context || !context.auth || !context.auth.uid) return fail('unauthenticated');
        if (await deps.isGuest(context)) return fail('guest');
        if (await deps.isOffline()) return fail('kill_switch');
        return null;
    }

    function premiumGate(ent, flags, nowMs, buying) {
        const s = summary(ent, nowMs);
        if (!s.active) return 'not_premium';
        if (buying && s.inTrial && !TRIAL_CAN_BUY) return 'trial';
        if (buying && s.inReferralWeek && flags.referralWeekPremiumBuy !== true) return 'flag_off';
        return null;
    }

    async function status(context) {
        if (!context || !context.auth || !context.auth.uid) return fail('unauthenticated');
        const uid = context.auth.uid;
        const nowMs = now();
        const flags = await readFlags();
        const wk = weekInfo(nowMs, flags.firstWindowEndMs);
        const r = refs(uid, null, wk.key);
        const snaps = await Promise.all([r.user.get(), r.ent.get(), r.week.get()]);
        const user = snaps[0].exists ? (snaps[0].data() || {}) : {};
        const ent = snaps[1].exists ? (snaps[1].data() || {}) : null;
        const week = snaps[2].exists ? (snaps[2].data() || {}) : {};
        const st = stateFrom(user);
        const guest = await deps.isGuest(context);
        return {
            success: true,
            premiumActive: summary(ent, nowMs).active,
            flags: { referralWeekPremiumBuy: flags.referralWeekPremiumBuy },
            open: isOpen(flags, nowMs),
            buildOpen: isBuildOpen(flags),
            stages: st.stages,
            ownedStages: st.ownedStages,
            parts: partsSummary(st),
            lessonParts: st.lessonParts,
            lessonBuilt: st.lessonBuilt,
            lessonGrantPending: !guest && isOpen(flags, nowMs) && pendingLessons(user).length > 0,
            weekSpent: week.weekKey === wk.key ? Math.max(0, Number(week.spent) || 0) : 0,
            weekCap: WEEKLY_CAP_OT,
            weekResetsAt: wk.endMs,
            newTickets: Math.max(0, Math.floor(Number(user.orangeTickets) || 0)),
        };
    }

    async function buy(context, data) {
        const g = await gate(context);
        if (g) return g;
        const uid = context.auth.uid;
        const d = data || {};
        const partId = typeof d.partId === 'string' && Object.prototype.hasOwnProperty.call(PARTS, d.partId) ? d.partId : null;
        const stage = Number.isInteger(d.stage) ? d.stage : null;
        const requestId = cleanRequestId(d.requestId);
        if (!partId || !stage || !requestId) return fail('bad_request');
        const part = PARTS[partId];
        const nowMs = now();
        const flags = await readFlags();
        if (!isOpen(flags, nowMs)) return fail('not_open');
        const createdMs = await deps.accountCreatedMs(uid);
        const wk = weekInfo(nowMs, flags.firstWindowEndMs);
        const r = refs(uid, requestId, wk.key);

        const out = await db.runTransaction(async function (tx) {
            const s = await Promise.all([tx.get(r.op), tx.get(r.user), tx.get(r.week), tx.get(r.ent), tx.get(r.ledger)]);
            if (s[0].exists) return replayOf(s[0].data(), uid, 'stage');
            if (!s[1].exists) return fail('no_profile');
            const user = s[1].data() || {};
            if (rewardBlocked(user, s[4].exists ? (s[4].data() || {}) : {})) return fail('banned');
            const pg = premiumGate(s[3].exists ? s[3].data() : null, flags, nowMs, true);
            if (pg) return fail(pg);
            if (tooYoung(createdMs, nowMs)) return fail('account_age');
            const st = stateFrom(user);
            // Stage order follows what the player has collected, not built.
            const have = st.ownedStages[partId];
            if (have >= part.stages) return fail('already_owned');
            if (stage !== have + 1) return fail('wrong_stage');
            const week = s[2].exists ? (s[2].data() || {}) : {};
            const spent = week.weekKey === wk.key ? Math.max(0, Number(week.spent) || 0) : 0;
            if (spent + part.price > WEEKLY_CAP_OT) return fail('weekly_cap');
            const balance = Math.max(0, Math.floor(Number(user.orangeTickets) || 0));
            if (balance < part.price) return fail('balance');

            // The bought stage goes to inventory (ownedStages). It is built later
            // with buildCitadelPart once building opens.
            const newOwned = Object.assign({}, st.ownedStages);
            newOwned[partId] = have + 1;
            const result = {
                success: true, partId: partId, stage: stage, price: part.price,
                ownedStages: newOwned, stages: Object.assign({}, st.stages),
                weekSpent: spent + part.price, weekCap: WEEKLY_CAP_OT,
                newTickets: balance - part.price,
            };
            const ownedPatch = {};
            ownedPatch[partId] = have + 1;
            tx.set(r.user, { orangeTickets: balance - part.price, citadel: { ownedStages: ownedPatch } }, { merge: true });
            tx.set(r.week, { uid: uid, weekKey: wk.key, spent: spent + part.price, updatedAtMs: nowMs, expireAt: new Date(wk.endMs + COUNTER_KEEP_DAYS * DAY_MS) });
            tx.create(r.op, Object.assign({
                uid: uid, kind: 'stage', partId: partId, stage: stage, price: part.price, weekKey: wk.key,
                result: result,
            }, purchaseMeta(nowMs)));
            return result;
        });
        log('[citadel] buy ' + (out.success ? 'ok' : out.code) + (out.repeat ? ' repeat' : '') + ' uid=' + maskUid(uid) + ' part=' + partId);
        return out;
    }

    // Builds one collected-but-unbuilt part: a paid stage { partId, stage } or
    // a lesson part { lessonPartId }. Opens only with config/citadelShop.buildOpen.
    // The part moves from collected to built in one transaction, and the stage
    // check plus the requestId row make a second build of the same part
    // impossible. Today a build finishes at once; a later build timer can hook
    // in here (write a pending build instead of the built count).
    async function build(context, data) {
        const g = await gate(context);
        if (g) return g;
        const uid = context.auth.uid;
        const d = data || {};
        const has = function (m, k) { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(m, k); };
        const lessonId = has(LESSON_PART_MAP, d.lessonPartId) ? d.lessonPartId : null;
        const partId = has(PARTS, d.partId) ? d.partId : null;
        const stage = Number.isInteger(d.stage) ? d.stage : null;
        const requestId = cleanRequestId(d.requestId);
        // Exactly one target: a lesson part, or a paid part with its stage.
        if (!requestId || (lessonId && d.partId !== undefined) || (!lessonId && (!partId || !stage))) return fail('bad_request');
        const nowMs = now();
        const flags = await readFlags();
        if (!isBuildOpen(flags)) return fail('not_build_open');
        const r = refs(uid, requestId, weekInfo(nowMs, flags.firstWindowEndMs).key);

        const out = await db.runTransaction(async function (tx) {
            const s = await Promise.all([tx.get(r.op), tx.get(r.user), tx.get(r.ent), tx.get(r.ledger)]);
            if (s[0].exists) return replayOf(s[0].data(), uid, 'build');
            if (!s[1].exists) return fail('no_profile');
            if (rewardBlocked(s[1].data() || {}, s[3].exists ? (s[3].data() || {}) : {})) return fail('banned');
            const pg = premiumGate(s[2].exists ? s[2].data() : null, flags, nowMs, false);
            if (pg) return fail(pg);
            const st = stateFrom(s[1].data() || {});
            if (lessonId) {
                if (!st.lessonParts[lessonId]) return fail('not_owned');
                if (st.lessonBuilt[lessonId]) return fail('already_built');
                const built = Object.assign({}, st.lessonBuilt);
                built[lessonId] = true;
                const result = { success: true, lessonPartId: lessonId, lessonBuilt: built };
                const patch = {};
                patch[lessonId] = true;
                tx.set(r.user, { citadel: { lessonBuilt: patch } }, { merge: true });
                tx.create(r.op, Object.assign({
                    uid: uid, kind: 'build', lessonPartId: lessonId, result: result,
                }, purchaseMeta(nowMs)));
                return result;
            }
            const builtNow = st.stages[partId];
            if (stage <= builtNow) return fail('already_built');
            if (stage > st.ownedStages[partId]) return fail('not_collected');
            if (stage !== builtNow + 1) return fail('wrong_stage');
            const stages = Object.assign({}, st.stages);
            stages[partId] = stage;
            const result = {
                success: true, partId: partId, stage: stage,
                stages: stages, ownedStages: Object.assign({}, st.ownedStages),
            };
            const patch = {};
            patch[partId] = stage;
            tx.set(r.user, { citadel: { stages: patch } }, { merge: true });
            tx.create(r.op, Object.assign({
                uid: uid, kind: 'build', partId: partId, stage: stage, result: result,
            }, purchaseMeta(nowMs)));
            return result;
        });
        log('[citadel] build ' + (out.success ? 'ok' : out.code) + (out.repeat ? ' repeat' : '') + ' uid=' + maskUid(uid) + ' id=' + (lessonId || partId));
        return out;
    }

    // Lesson parts: free and Premium alike, from server-only lqPassed. Each part
    // is granted at most once per uid; a repeat call grants nothing.
    async function claimLessons(context) {
        const g = await gate(context);
        if (g) return g;
        // Nothing opens on live before Jan 3, 2027. lqPassed is kept, so a
        // player who passed lessons earlier is granted on the first call after.
        if (!isOpen(await readFlags(), now())) return fail('not_open');
        const uid = context.auth.uid;
        const nowMs = now();
        const createdMs = await deps.accountCreatedMs(uid);
        if (tooYoung(createdMs, nowMs)) return fail('account_age');
        const userRef = db.collection('users').doc(uid);
        const ledgerRef = db.collection('faucet_ledger').doc(uid);
        const out = await db.runTransaction(async function (tx) {
            const snap = await tx.get(userRef);
            const ledgerSnap = await tx.get(ledgerRef);
            if (!snap.exists) return fail('no_profile');
            const user = snap.data() || {};
            if (rewardBlocked(user, ledgerSnap.exists ? (ledgerSnap.data() || {}) : {})) return fail('banned');
            const grant = pendingLessons(user);
            const lessonParts = Object.assign({}, stateFrom(user).lessonParts);
            if (!grant.length) return { success: true, granted: [], lessonParts: lessonParts };
            const patch = {};
            grant.forEach(function (id) { patch[id] = true; lessonParts[id] = true; });
            tx.set(userRef, { citadel: { lessonParts: patch } }, { merge: true });
            return { success: true, granted: grant, lessonParts: lessonParts };
        });
        if (out.success && out.granted.length) log('[citadel] lesson parts granted uid=' + maskUid(uid) + ' n=' + out.granted.length);
        return out;
    }

    return { status: status, buy: buy, build: build, claimLessons: claimLessons };
}

module.exports = {
    createCitadelShopService,
    premiumSummaryLocal,
    weekInfo,
    pendingLessons,
    stateFrom,
    partsSummary,
    maskUid,
    PARTS,
    LESSON_PART_MAP,
    WEEKLY_CAP_OT,
    MIN_ACCOUNT_AGE_DAYS,
    TRIAL_CAN_BUY,
    PRE_JAN3_OT_SPENDABLE,
    OPENS_AT_MS,
    COUNTER_KEEP_DAYS,
    PURCHASE_KEEP_MONTHS,
    MESSAGES,
};
