'use strict';

// STAGING-ONLY test hook (PR #376 QA). Lets the faucet (claimSats) and the
// cipher payouts (claimCipherSats, claimCipherWin) use the same in-process fake
// wallet as Satoshi's Favor, so QA can drive every pay and lookup outcome.
//
// Gate: active only when BOTH are true:
//   1. the project is bitcoin-quest-staging (checked before any read), and
//   2. config/satoshiFavorPayouts.mockWallet === true (the existing flag).
// On any other project load() returns null without reading Firestore, and
// createMockWallet() throws, so this can never pay or fake a result on live.
//
// Config fields (config/satoshiFavorPayouts, staging only):
//   mockPayOutcome:     'paid' (default) | 'refuse' (code PAYMENT_FAILED)
//                       | 'refuse_ours' (code INSUFFICIENT_BALANCE)
//                       | 'message_only' (code INTERNAL, message mentions PAYMENT_FAILED)
//                       | 'refuse_text' (message 'PAYMENT_FAILED', NO error.code)
//                       | 'timeout' ([TIMEOUT] payInvoice, no code)
//   mockLookupOutcome:  'pending' (default) | 'failed' | 'settled'
//                       | 'unknown' / 'empty' ({}) | 'error' (throws NOT_FOUND)
//                       | 'unclassified' ({ state: 'mystery' })
//   mockBalanceOutcome: 'ok' (default) | 'timeout' ([TIMEOUT] getBalance) | 'low' (0 sats)
//   mockWalletBalanceSats, mockFeesPaidMsat, mockBlankPubkey: as for Favor.

const crypto = require('crypto');

const STAGING_PROJECT = 'bitcoin-quest-staging';
const PAY_OUTCOMES = ['paid', 'refuse', 'refuse_ours', 'message_only', 'refuse_text', 'timeout'];
const LOOKUP_OUTCOMES = ['pending', 'failed', 'settled', 'unknown', 'empty', 'error', 'unclassified'];
const BALANCE_OUTCOMES = ['ok', 'timeout', 'low'];
const MOCK_NODE_PUBKEY = '02' + 'ab'.repeat(32);

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

function pick(list, v, dflt) { return list.indexOf(v) !== -1 ? v : dflt; }
function nonNegInt(v, max, dflt) {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n < 0) return dflt;
    return Math.min(n, max);
}

function readMockConfig(raw) {
    const d = raw || {};
    return {
        mockWallet: d.mockWallet === true,
        mockWalletBalanceSats: nonNegInt(d.mockWalletBalanceSats, 10000000, 50000),
        mockPayOutcome: pick(PAY_OUTCOMES, d.mockPayOutcome, 'paid'),
        mockLookupOutcome: pick(LOOKUP_OUTCOMES, d.mockLookupOutcome, 'pending'),
        mockBalanceOutcome: pick(BALANCE_OUTCOMES, d.mockBalanceOutcome, 'ok'),
        mockFeesPaidMsat: nonNegInt(d.mockFeesPaidMsat, 100000000, 0),
        mockBlankPubkey: d.mockBlankPubkey === true,
    };
}

// null unless staging AND the mockWallet flag is on. Never reads on live.
async function load(db) {
    if (!isStagingProject()) return null;
    const snap = await db.collection('config').doc('satoshiFavorPayouts').get();
    const cfg = readMockConfig(snap.exists ? (snap.data() || {}) : {});
    return cfg.mockWallet === true ? cfg : null;
}

function codedError(message, code) {
    const e = new Error(message);
    if (code) e.code = code;
    return e;
}

function createMockWallet(rawCfg) {
    if (!isStagingProject()) throw new Error('mock wallet is staging only');
    const cfg = readMockConfig(rawCfg);
    if (cfg.mockWallet !== true) throw new Error('mock wallet is off');
    return {
        getBalance: async function () {
            if (cfg.mockBalanceOutcome === 'timeout') throw new Error('[TIMEOUT] getBalance timed out after 20000ms');
            if (cfg.mockBalanceOutcome === 'low') return { balance: 0 };
            return { balance: cfg.mockWalletBalanceSats * 1000 };
        },
        getInfo: async function () { return { pubkey: cfg.mockBlankPubkey === true ? '' : MOCK_NODE_PUBKEY }; },
        payInvoice: async function () {
            switch (cfg.mockPayOutcome) {
                case 'refuse': throw codedError('PAYMENT_FAILED', 'PAYMENT_FAILED');
                case 'refuse_ours': throw codedError('INSUFFICIENT_BALANCE', 'INSUFFICIENT_BALANCE');
                case 'message_only': throw codedError('receiver said: PAYMENT_FAILED (staging mock)', 'INTERNAL');
                case 'refuse_text': throw new Error('PAYMENT_FAILED');
                case 'timeout': throw new Error('[TIMEOUT] payInvoice timed out after 30000ms');
                default: return { preimage: crypto.randomBytes(32).toString('hex'), fees_paid: cfg.mockFeesPaidMsat || 0 };
            }
        },
        lookupInvoice: async function () {
            switch (cfg.mockLookupOutcome) {
                case 'failed': return { state: 'failed' };
                case 'settled': return { state: 'settled', preimage: crypto.randomBytes(32).toString('hex') };
                case 'unknown':
                case 'empty': return {};
                case 'error': throw codedError('NOT_FOUND', 'NOT_FOUND');
                case 'unclassified': return { state: 'mystery' };
                default: return { state: 'pending' };
            }
        },
    };
}

module.exports = {
    STAGING_PROJECT: STAGING_PROJECT,
    PAY_OUTCOMES: PAY_OUTCOMES,
    LOOKUP_OUTCOMES: LOOKUP_OUTCOMES,
    BALANCE_OUTCOMES: BALANCE_OUTCOMES,
    MOCK_NODE_PUBKEY: MOCK_NODE_PUBKEY,
    isStagingProject: isStagingProject,
    readMockConfig: readMockConfig,
    load: load,
    createMockWallet: createMockWallet,
};
