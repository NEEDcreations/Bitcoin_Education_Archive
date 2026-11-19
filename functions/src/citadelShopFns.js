'use strict';

// Firebase wiring for the Citadel shop callables. The logic lives in
// citadelShop.js (pure + injected deps, tested in tests/test-citadel-shop-server.js).
// NEVER DEPLOYED: Rufus deploys these by name only after review, Red Team and
// Security sign-off, because buyCitadelStage debits OrangeTix.

const core = require('./citadelShop');
const guestGate = require('./guestGate');

const STAGING_PROJECT = 'bitcoin-quest-staging';
function projectId() {
    if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
    if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
    try {
        const cfg = JSON.parse(process.env.FIREBASE_CONFIG || '{}');
        if (cfg && cfg.projectId) return cfg.projectId;
    } catch (e) { /* fall through */ }
    return '';
}

// Use #322's server Premium status when it is in the build; the local copy
// follows the same rules on premium_entitlements/{uid}.
function premiumSummary(ent, nowMs) {
    let premium = null;
    try { premium = require('./premium'); } catch (e) { premium = null; }
    if (premium && typeof premium.isPremiumActive === 'function') {
        const local = core.premiumSummaryLocal(ent, nowMs);
        const active = premium.isPremiumActive(ent, nowMs);
        const inReferralWeek = typeof premium.inReferralWeek === 'function' ? premium.inReferralWeek(ent, nowMs) : local.inReferralWeek;
        return { active: active, inTrial: active && local.inTrial, inReferralWeek: inReferralWeek };
    }
    return core.premiumSummaryLocal(ent, nowMs);
}

function factory(functionsV1, opts) {
    const db = opts.db;
    const admin = opts.admin;

    function service() {
        return core.createCitadelShopService({
            db: db,
            nowMs: Date.now,
            isOffline: function () { return require('./killSwitch').isOffline(db); },
            isGuest: function (context) { return guestGate.isGuestCaller(admin, context); },
            accountCreatedMs: async function (uid) {
                try {
                    const rec = await admin.auth().getUser(uid);
                    return new Date(rec.metadata && rec.metadata.creationTime).getTime();
                } catch (e) {
                    return NaN; // unknown age fails the age check (fail closed)
                }
            },
            premiumSummary: premiumSummary,
            isStaging: function () { return projectId() === STAGING_PROJECT; },
            log: function (msg) { console.log(msg); },
        });
    }

    async function stepUp(data, context) {
        const secondFactor = require('./secondFactor');
        await secondFactor.requireSecondFactor(secondFactor.stamp(data, context));
    }

    // Input {} only. Read-only: stages, lesson parts, weekly spend, flags, Premium.
    const getCitadelShopStatus = functionsV1.https.onCall(async function (data, context) {
        return service().status(context);
    });
    // Input { partId, stage, requestId } only. Debits OrangeTix.
    const buyCitadelStage = functionsV1.https.onCall(async function (data, context) {
        await stepUp(data, context);
        return service().buy(context, data);
    });
    // Input { lessonPartId, requestId } only. No OrangeTix.
    const buildCitadelPart = functionsV1.https.onCall(async function (data, context) {
        await stepUp(data, context);
        return service().build(context, data);
    });
    // Input {} only. Grants lesson parts from lqPassed, once per uid.
    const claimLessonParts = functionsV1.https.onCall(async function (data, context) {
        return service().claimLessons(context);
    });

    return {
        getCitadelShopStatus: getCitadelShopStatus,
        buyCitadelStage: buyCitadelStage,
        buildCitadelPart: buildCitadelPart,
        claimLessonParts: claimLessonParts,
        service: service,
    };
}

module.exports = { factory, premiumSummary };
