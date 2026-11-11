'use strict';

// Per-function runtime service accounts for every function that binds a
// Secret Manager secret. Each listed function runs as its own account, and
// that account is granted secretAccessor only on the secrets the function
// lists in its own `secrets:` option (see scripts/runtime-sa-plan.js and
// tests/test-runtime-service-accounts.js). Functions not listed here bind no
// secrets and stay on the default runtime accounts for now (phase 2 moves
// them to a shared no-secret account and removes roles/editor).
//
// `id` is the service account id (6–30 chars). runtimeSa() returns the full
// email `<id>@<project>.iam.gserviceaccount.com` for the project the code is
// loaded in (GCLOUD_PROJECT, set by the Firebase CLI at deploy and by the
// runtime; else FIREBASE_CONFIG.projectId; else the .firebaserc default).
// The `<id>@` shorthand is not used because firebase-functions v1 throws at
// module load when GCLOUD_PROJECT is unset (tests, scripts).
//
// `extra` lists least-privilege roles beyond Firestore (roles/datastore.user,
// which every listed function gets):
//   auth    -> roles/firebaseauth.admin
//   fcm     -> roles/firebasecloudmessaging.admin
//   storage -> roles/storage.objectAdmin on the default bucket only
// Gen2 event and scheduled triggers also need roles/run.invoker on their own
// Cloud Run service, and gen2 event triggers need roles/eventarc.eventReceiver;
// the plan script derives those from the trigger type.
//
// adminApproveFactionPayout is intentionally absent: it stays undeployed.
// The accounts must exist and carry their grants BEFORE a function that
// references them is deployed, or the deploy fails (it never silently falls
// back to the default account).

const RUNTIME_SERVICE_ACCOUNTS = Object.freeze({
    adminBanUser: { id: 'fn-admin-ban-user', extra: [] },
    adminLookupUser: { id: 'fn-admin-lookup-user', extra: [] },
    adminQueryUsers: { id: 'fn-admin-query-users', extra: [] },
    adminResolveCipherSatsClaim: { id: 'fn-admin-resolve-cipher-claim', extra: [] },
    adminUnbanUser: { id: 'fn-admin-unban-user', extra: [] },
    auditWithdrawals: { id: 'fn-audit-withdrawals', extra: [] },
    backfillJoinDates: { id: 'fn-backfill-join-dates', extra: ['auth'] },
    claimCipherSats: { id: 'fn-claim-cipher-sats', extra: ['auth'] },
    claimCipherWin: { id: 'fn-claim-cipher-win', extra: ['auth'] },
    claimSats: { id: 'fn-claim-sats', extra: ['auth', 'fcm'] },
    confirmAccountLink: { id: 'fn-confirm-account-link', extra: ['auth'] },
    confirmTipSent: { id: 'fn-confirm-tip-sent', extra: ['fcm'] },
    dailyActiveUsers: { id: 'fn-daily-active-users', extra: ['auth'] },
    deleteAccount: { id: 'fn-delete-account', extra: ['auth', 'storage'] },
    flushTelegramMirror: { id: 'fn-flush-telegram-mirror', extra: [] },
    getFaucetStats: { id: 'fn-get-faucet-stats', extra: [] },
    handleTelegramWebhook: { id: 'fn-handle-telegram-webhook', extra: [] },
    investigateUsers: { id: 'fn-investigate-users', extra: ['auth'] },
    onAnnouncementsTelegram: { id: 'fn-on-announcements-telegram', extra: [] },
    onAnnouncementsTelegramDeleted: { id: 'fn-on-ann-tg-deleted', extra: [] },
    onAnnouncementsTelegramUpdated: { id: 'fn-on-ann-tg-updated', extra: [] },
    onForumShoutoutDeleted: { id: 'fn-on-forum-shoutout-deleted', extra: [] },
    onForumShoutoutUpdated: { id: 'fn-on-forum-shoutout-updated', extra: [] },
    onGlobalChatTelegram: { id: 'fn-on-global-chat-telegram', extra: [] },
    onGlobalChatTelegramDeleted: { id: 'fn-on-global-chat-tg-deleted', extra: [] },
    onGlobalChatTelegramUpdated: { id: 'fn-on-global-chat-tg-updated', extra: [] },
    onMarketplaceShoutoutDeleted: { id: 'fn-on-mkt-so-deleted', extra: [] },
    onMarketplaceShoutoutUpdated: { id: 'fn-on-mkt-so-updated', extra: [] },
    onUserReferral: { id: 'fn-on-user-referral', extra: ['auth', 'fcm'] },
    payQualifiedReferrals: { id: 'fn-pay-qualified-referrals', extra: ['auth', 'fcm'] },
    prepareEmailChange: { id: 'fn-prepare-email-change', extra: ['auth'] },
    refreshBadgeDistributionHttp: { id: 'fn-refresh-badge-dist-http', extra: ['auth', 'storage'] },
    refreshHotTopics: { id: 'fn-refresh-hot-topics', extra: ['fcm'] },
    refreshHotTopicsForce: { id: 'fn-refresh-hot-topics-force', extra: ['fcm'] },
    refreshHotTopicsHttp: { id: 'fn-refresh-hot-topics-http', extra: ['fcm'] },
    regenerateRecoveryCodes: { id: 'fn-regenerate-recovery-codes', extra: ['auth'] },
    registerReferral: { id: 'fn-register-referral', extra: ['auth', 'fcm'] },
    resetLightningAddressOnce: { id: 'fn-reset-ln-addr-once', extra: [] },
    scheduleRaidBoss: { id: 'fn-schedule-raid-boss', extra: [] },
    scheduleRaidBossCatchup: { id: 'fn-schedule-raid-boss-catchup', extra: [] },
    setTelegramWebhook: { id: 'fn-set-telegram-webhook', extra: [] },
    setUsername: { id: 'fn-set-username', extra: ['auth'] },
    stravaAuth: { id: 'fn-strava-auth', extra: [] },
    syncEmailChange: { id: 'fn-sync-email-change', extra: ['auth'] },
    syncStravaWalks: { id: 'fn-sync-strava-walks', extra: [] },
    // #287: own SA so only it reads TCTV_LINK_HMAC_KEY (no NWC).
    tctvDripCheckin: { id: 'fn-tctv-drip-checkin', extra: ['auth'] },
    tctvDripTick: { id: 'fn-tctv-drip-tick', extra: ['auth'] },
    totpCheck: { id: 'fn-totp-check', extra: ['auth'] },
    totpDisable: { id: 'fn-totp-disable', extra: ['auth'] },
    totpSetup: { id: 'fn-totp-setup', extra: ['auth'] },
    totpStepUp: { id: 'fn-totp-step-up', extra: ['auth'] },
    totpVerify: { id: 'fn-totp-verify', extra: ['auth'] },
    tweetSatoshisFavor: { id: 'fn-tweet-satoshis-favor', extra: ['fcm'] },
    verifyReferral: { id: 'fn-verify-referral', extra: ['auth', 'fcm'] },
    watchlistCheck: { id: 'fn-watchlist-check', extra: [] },
});

const DEFAULT_PROJECT = 'bitcoin-education-archive';

const EXTRA_ROLES = Object.freeze({
    auth: 'roles/firebaseauth.admin',
    fcm: 'roles/firebasecloudmessaging.admin',
    storage: 'roles/storage.objectAdmin',
});

function runtimeSa(functionName) {
    const entry = Object.prototype.hasOwnProperty.call(RUNTIME_SERVICE_ACCOUNTS, functionName)
        ? RUNTIME_SERVICE_ACCOUNTS[functionName] : null;
    if (!entry) throw new Error('No runtime service account for ' + functionName);
    return entry.id + '@' + projectId() + '.iam.gserviceaccount.com';
}

function projectId() {
    if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
    if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
    try {
        const cfg = JSON.parse(process.env.FIREBASE_CONFIG || '{}');
        if (cfg && cfg.projectId) return cfg.projectId;
    } catch (err) { /* fall through */ }
    return DEFAULT_PROJECT;
}

module.exports = {
    RUNTIME_SERVICE_ACCOUNTS: RUNTIME_SERVICE_ACCOUNTS,
    EXTRA_ROLES: EXTRA_ROLES,
    runtimeSa: runtimeSa,
};
