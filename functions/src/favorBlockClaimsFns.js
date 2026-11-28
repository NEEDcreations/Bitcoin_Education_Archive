'use strict';

// Firebase wiring for Satoshi's Favor per-block self-claims.
// The money logic lives in favorBlockClaims.js (pure + injected deps, tested).

const { defineSecret } = require('firebase-functions/params');
const bolt11 = require('bolt11');
const core = require('./favorBlockClaims');
const { runtimeSa } = require('./runtimeServiceAccounts');
const { nwcUrlSecret, nwcUrl } = require('./nwcSecret');
const { shouldLookupPay, lookupSettlement, assessCipherClaim, classifyLookup } = require('./cipherClaim');

const deletionHmacSecret = defineSecret('DELETION_HMAC_SECRET');
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
function isStagingProject() { return projectId() === STAGING_PROJECT; }

// Staging never binds the wallet secret, so a staging build cannot reach a
// real wallet. It pays through this in-process fake instead, and only when
// config/satoshiFavorPayouts.mockWallet is true on the staging project.
const MOCK_NODE_PUBKEY = '02' + 'ab'.repeat(32);
function mockWallet(cfg) {
    // Shared staging-only fake (src/stagingMockWallet.js). Throws off staging.
    return require('./stagingMockWallet').createMockWallet(cfg);
}

// Staging mock invoices: a real, signed mainnet-format BOLT11 for the exact
// amount from a throwaway key, so the decode checks run for real.
// hint: 'none' | 'normal' (tiny route-hint fee) | 'high' (inflated hint fee),
// so the route-hint fee cap can be proven on staging.
const MOCK_HINTS = {
    normal: { fee_base_msat: 1000, fee_proportional_millionths: 100 },
    high: { fee_base_msat: 50000, fee_proportional_millionths: 50000 },
};
function mockInvoice(sats, hint) {
    const crypto = require('crypto');
    const key = crypto.randomBytes(32).toString('hex');
    const tags = [
        { tagName: 'payment_hash', data: crypto.randomBytes(32).toString('hex') },
        { tagName: 'payment_secret', data: crypto.randomBytes(32).toString('hex') },
        { tagName: 'description', data: 'staging favor mock' },
        { tagName: 'expire_time', data: 600 },
    ];
    if (MOCK_HINTS[hint]) {
        tags.push({ tagName: 'routing_info', data: [Object.assign({
            pubkey: (function () { const e = crypto.createECDH('secp256k1'); e.generateKeys(); return e.getPublicKey('hex', 'compressed'); })(),
            short_channel_id: '0000010000020003',
            cltv_expiry_delta: 40,
        }, MOCK_HINTS[hint])] });
    }
    const enc = bolt11.encode({
        network: { bech32: 'bc', pubKeyHash: 0x00, scriptHash: 0x05, validWitnessVersions: [0] },
        millisatoshis: String(sats * 1000),
        timestamp: Math.floor(Date.now() / 1000),
        tags: tags,
    });
    return bolt11.sign(enc, key).paymentRequest;
}

// Staging only: a fake address tagged '+highfee' / '+normalhint' gets that
// hint, so one test account can be refused without flipping shared config.
function mockHintFor(ln, cfg) {
    const a = String(ln || '');
    if (/\+highfee@/.test(a)) return 'high';
    if (/\+normalhint@/.test(a)) return 'normal';
    return cfg && cfg.mockRouteHint;
}

function withTimeout(promise, ms, label) {
    return Promise.race([
        promise,
        new Promise(function (_, reject) { setTimeout(function () { reject(new Error('[TIMEOUT] ' + label)); }, ms); }),
    ]);
}

function factory(functionsV1, deps) {
    const db = deps.db;
    const admin = deps.admin;
    const HttpsError = functionsV1.https.HttpsError;
    const staging = isStagingProject();

    function requireAdmin(context) {
        if (!context || !context.auth || !context.auth.uid) throw new HttpsError('unauthenticated', 'Sign in');
        if (!context.auth.token || context.auth.token.admin !== true) throw new HttpsError('permission-denied', 'Admin only');
    }

    async function notifyAdmin(text, extra) {
        await db.collection('admin_notifications').add({
            type: 'sf_block_claim',
            text: String(text).slice(0, 500),
            epoch: extra && extra.epoch != null ? extra.epoch : null,
            block: extra && extra.block != null ? extra.block : null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
        });
    }

    async function accountGate(uid, context) {
        let authUser = null;
        try { authUser = await admin.auth().getUser(uid); }
        catch (e) { return { ok: false, code: 'deleted' }; }
        if (!authUser || authUser.disabled) return { ok: false, code: 'disabled' };
        if (!Array.isArray(authUser.providerData) || !authUser.providerData.length) return { ok: false, code: 'anonymous' };
        const userSnap = await db.collection('users').doc(uid).get();
        if (!userSnap.exists) return { ok: false, code: 'no_user' };
        const u = userSnap.data() || {};
        if (u.mergedInto) return { ok: false, code: 'merged' };
        if (u.deleted === true || u.deletedAt || u.accountDeleted === true) return { ok: false, code: 'deleted' };
        if (u.banned === true || u.isBanned === true) return { ok: false, code: 'banned' };
        if (Number(u.satsHold) > Date.now()) return { ok: false, code: 'hold' };
        // Sats need a confirmed 18+ answer (fields set by confirmAge18).
        const age18 = require('./age18Sats').assess(u);
        if (!age18.ok) return { ok: false, code: 'age_18_required', reason: age18.reason, error: age18.error };
        const ledger = await db.collection('faucet_ledger').doc(uid).get();
        const ledgerBanned = ledger.exists && (ledger.data() || {}).banned === true;
        const accountTombstone = require('./accountTombstone');
        const emailChange = require('./emailChange');
        if (!accountTombstone.secretReady()) return { ok: false, code: 'paused' };
        const token = (context.auth && context.auth.token) || {};
        const gate = await emailChange.beginPayout(db, admin.auth(), uid, authUser, Date.now(), token, true);
        if (gate && gate.unavailable) return { ok: false, code: 'unavailable' };
        if (!gate.ok) return { ok: false, code: 'hold' };
        const tomb = gate.tomb || { summary: {} };
        const s = tomb.summary || {};
        if (s.banned || s.satsDisabled || s.ledgerBanned) {
            try { await accountTombstone.applyIdentityFlags(db, uid, s); } catch (e) { /* still refused */ }
            return { ok: false, code: 'banned' };
        }
        // Claims age-gate hardening: later of Auth creation and users.realAccountAt.
        const realAge = gate.age || { ageKnown: false, ageDays: 0 };
        const verified = !!(authUser.email && authUser.emailVerified === true);
        const g = assessCipherClaim({
            email: verified ? authUser.email : '',
            emailVerified: verified,
            ageKnown: realAge.ageKnown === true,
            ageDays: realAge.ageKnown === true ? realAge.ageDays : 0,
            ageSource: realAge.ageSource,
            satsDisabled: u.satsDisabled === true,
            ledgerBanned: ledgerBanned,
        });
        if (!g.ok) return { ok: false, code: 'claim_rules', detail: g.error };
        return { ok: true };
    }

    function service() {
        const secondFactor = require('./secondFactor');
        const { NWCClient } = require('@getalby/sdk');
        const { resolveLnurlInvoice } = require('./lnurlResolve');
        return core.createBlockClaimService({
            db: db,
            nowMs: Date.now,
            withTimeout: withTimeout,
            isOffline: function () { return require('./killSwitch').isOffline(db); },
            accountGate: accountGate,
            stepUp: async function (context, data) {
                const ctx = secondFactor.stamp(data, context);
                await secondFactor.requireSecondFactor(ctx);
                await secondFactor.requireFreshStepUp(ctx, 'claimFavorBlock');
            },
            recentSignIn: secondFactor.recentSignIn,
            wallet: function (cfg) {
                if (staging) {
                    // Defence in depth: a staging build never pays with a real
                    // wallet string, even if one is somehow in the environment.
                    if (nwcUrl()) throw new Error('staging must not have NWC_URL');
                    if (cfg.mockWallet !== true) throw new Error('staging has no wallet');
                    return mockWallet(cfg);
                }
                const url = nwcUrl();
                if (!url) throw new Error('NO_WALLET');
                return new NWCClient({ nostrWalletConnectUrl: url });
            },
            resolveInvoice: async function (ln, sats, cfg) {
                if (staging) return mockInvoice(sats, mockHintFor(ln, cfg));
                const r = await resolveLnurlInvoice({ address: ln, msats: sats * 1000, bolt11: bolt11 });
                return r.pr;
            },
            decodeInvoice: function (bolt) { return bolt11.decode(bolt); },
            shouldLookupPay: shouldLookupPay,
            lookupSettlement: lookupSettlement,
            classifyLookup: classifyLookup,
            notifyAdmin: notifyAdmin,
            logWarn: function (msg, data) { require('firebase-functions/logger').warn(msg, data || {}); },
        });
    }

    // Player: claim one archived block. Input { epoch, block } only.
    const claimFavorBlock = functionsV1.runWith({
        enforceAppCheck: true,
        timeoutSeconds: 180,
        secrets: staging ? [deletionHmacSecret] : [deletionHmacSecret, nwcUrlSecret],
        serviceAccount: runtimeSa('claimFavorBlock'),
    }).https.onCall(async function (data, context) {
        return service().claim(context, data);
    });

    // Player: my own blocks for the epochs shown in Epoch History.
    const myFavorEpochClaims = functionsV1.runWith({ enforceAppCheck: true }).https.onCall(async function (data, context) {
        if (!context || !context.auth || !context.auth.uid) throw new HttpsError('unauthenticated', 'Sign in');
        return service().listMine(context, data || {});
    });

    // Admin: switches and caps. Fresh admin 2FA every time.
    const adminSetFavorClaims = functionsV1.runWith({ enforceAppCheck: true }).https.onCall(async function (data, context) {
        requireAdmin(context);
        const secondFactor = require('./secondFactor');
        await secondFactor.requireAdminStepUp(secondFactor.stamp(data, context), 'adminSetFavorClaims');
        const d = data || {};
        const patch = {};
        if (typeof d.claimsEnabled === 'boolean') patch.claimsEnabled = d.claimsEnabled;
        if (Array.isArray(d.enabledEpochs)) {
            const eps = core.readConfig({ enabledEpochs: d.enabledEpochs }).enabledEpochs;
            if (eps.length !== d.enabledEpochs.length) throw new HttpsError('invalid-argument', 'Bad epoch list');
            patch.enabledEpochs = eps;
        }
        ['perClaimCapSats', 'perUidDailySats', 'siteDailySats', 'monthlySats', 'walletFloorSats', 'maxAttempts'].forEach(function (k) {
            if (d[k] != null) {
                const n = Math.floor(Number(d[k]));
                if (!Number.isFinite(n) || n <= 0) throw new HttpsError('invalid-argument', 'Bad ' + k);
                if (k === 'perClaimCapSats' && n > core.HARD_PER_CLAIM_CAP_SATS) throw new HttpsError('invalid-argument', 'Per-claim cap is at most 5,000');
                patch[k] = n;
            }
        });
        if (d.mockWallet != null || d.mockWalletBalanceSats != null || d.mockPayOutcome != null || d.mockRouteHint != null || d.mockFeesPaidMsat != null || d.mockBlankPubkey != null || d.mockLookupOutcome != null || d.mockBalanceOutcome != null) {
            if (!staging) throw new HttpsError('permission-denied', 'Mock wallet is staging only');
            if (d.mockRouteHint != null) patch.mockRouteHint = ['none', 'normal', 'high'].indexOf(d.mockRouteHint) !== -1 ? d.mockRouteHint : 'none';
            if (d.mockFeesPaidMsat != null) patch.mockFeesPaidMsat = Math.max(0, Math.floor(Number(d.mockFeesPaidMsat)) || 0);
            if (d.mockWallet != null) patch.mockWallet = d.mockWallet === true;
            if (d.mockBlankPubkey != null) patch.mockBlankPubkey = d.mockBlankPubkey === true;
            if (d.mockWalletBalanceSats != null) patch.mockWalletBalanceSats = Math.floor(Number(d.mockWalletBalanceSats)) || 0;
            const smw = require('./stagingMockWallet');
            if (d.mockPayOutcome != null) patch.mockPayOutcome = smw.PAY_OUTCOMES.indexOf(d.mockPayOutcome) !== -1 ? d.mockPayOutcome : 'paid';
            if (d.mockLookupOutcome != null) patch.mockLookupOutcome = smw.LOOKUP_OUTCOMES.indexOf(d.mockLookupOutcome) !== -1 ? d.mockLookupOutcome : 'pending';
            if (d.mockBalanceOutcome != null) patch.mockBalanceOutcome = smw.BALANCE_OUTCOMES.indexOf(d.mockBalanceOutcome) !== -1 ? d.mockBalanceOutcome : 'ok';
        }
        // Clearing a routing-fee halt is its own explicit, audited step.
        if (d.clearFeeHalt === true) {
            await db.collection('sf_claim_counters').doc(core.FEE_HALT_DOC_ID).set({ halted: false, clearedAtMs: Date.now(),
                clearedBy: core.maskUid(context.auth.uid) }, { merge: true });
            await db.collection('sf_claim_audit').add({ type: 'fee_halt_cleared', atMs: Date.now(), by: core.maskUid(context.auth.uid) });
            if (!Object.keys(patch).length) return { ok: true, feeHaltCleared: true };
        }
        if (!Object.keys(patch).length) throw new HttpsError('invalid-argument', 'Nothing to change');
        patch.updatedAtMs = Date.now();
        patch.updatedBy = core.maskUid(context.auth.uid);
        await db.collection('config').doc('satoshiFavorPayouts').set(patch, { merge: true });
        await db.collection('sf_claim_audit').add({ type: 'config', atMs: Date.now(), by: core.maskUid(context.auth.uid), patch: patch });
        const snap = await db.collection('config').doc('satoshiFavorPayouts').get();
        return { ok: true, config: core.readConfig(snap.exists ? snap.data() : {}) };
    });

    // Admin: freeze (backfill) one closed epoch's per-block result from
    // sfPoolHistory. Create-only; never touches sfPoolHistory. dryRun shows it.
    const adminFreezeFavorEpoch = functionsV1.runWith({ enforceAppCheck: true }).https.onCall(async function (data, context) {
        requireAdmin(context);
        const secondFactor = require('./secondFactor');
        await secondFactor.requireAdminStepUp(secondFactor.stamp(data, context), 'adminFreezeFavorEpoch');
        const r = await service().freezeEpoch(data && data.epoch, { source: 'backfill', dryRun: !!(data && data.dryRun) });
        const res = r.result || null;
        return {
            ok: !!r.ok, reason: r.reason || '', created: !!r.created, existed: !!r.existed, dryRun: !!r.dryRun,
            blocks: res && Array.isArray(res.blocks) ? res.blocks.map(function (b) {
                return { block: b.block, uid: core.maskUid(b.uid), amount: b.amount, payTo: core.maskLn(b.frozenLn), manualReview: b.manualReview || '' };
            }) : [],
        };
    });

    // Admin: release one manual-review block to its frozen winner, or reject it
    // for good. Input { epoch, block, action: 'release'|'reject', note } only.
    // Never pays. Fresh admin step-up on every call; App Check; kill-switch gated.
    // It does NOT bind the wallet secret: a block with a prior payment hash needs
    // an explicit failed lookup, which this function cannot get, so such blocks
    // are refused (fail closed) and need a person to check the wallet.
    const adminResolveFavorReview = functionsV1.runWith({
        enforceAppCheck: true,
        timeoutSeconds: 60,
    }).https.onCall(async function (data, context) {
        requireAdmin(context);
        const secondFactor = require('./secondFactor');
        await secondFactor.requireAdminStepUp(secondFactor.stamp(data, context), 'adminResolveFavorReview');
        const d = data || {};
        return service().resolveReview(context.auth.uid, { epoch: d.epoch, block: d.block, action: d.action, note: d.note });
    });

    return {
        adminResolveFavorReview: adminResolveFavorReview,
        claimFavorBlock: claimFavorBlock,
        accountGate: accountGate,
        myFavorEpochClaims: myFavorEpochClaims,
        adminSetFavorClaims: adminSetFavorClaims,
        adminFreezeFavorEpoch: adminFreezeFavorEpoch,
        service: service,
    };
}

module.exports = { factory, isStagingProject, mockInvoice, mockHintFor, MOCK_NODE_PUBKEY, STAGING_PROJECT };
