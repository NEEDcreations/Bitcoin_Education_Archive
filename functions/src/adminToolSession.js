'use strict';

// Admin banner tools need a fresh second-factor check on every open.
//
// totpStepUp({ tool, code }) (secondFactor.js) verifies a NEW authenticator
// code for an admin and writes admin_tool_sessions/{uid}_{tool} with a random
// session id that lasts TOOL_SESSION_TTL_MS. Each new step-up for a tool
// replaces the row, so the previous opening of that tool stops working.
// Every admin callable behind a banner tool calls requireAdminToolSession()
// with the session id the client got back, on top of its own admin-claim
// check. A session for one tool never opens another tool.
//
// The collection is server-only (firestore.rules ends in a deny-all match).
// Nothing here reads or prints a secret.

const crypto = require('crypto');
const functionsV1 = require('firebase-functions/v1');

const COLLECTION = 'admin_tool_sessions';
const TOOL_SESSION_TTL_MS = 5 * 60 * 1000;
const SESSION_RE = /^[a-f0-9]{32}$/;

// Every tile on the Admin tools banner (admin-panel.js GROUPS ids).
const ADMIN_TOOLS = Object.freeze({
    killSwitch: 'Kill switch',
    cipherWins: 'Cipher sats wins',
    factionPrize: 'Faction race payouts',
    faucetAbuse: 'Faucet abuse reports',
    factionBackfill: 'Faction totals recount',
    chat: 'Global Chat',
    forum: 'Forum',
    topics: 'Topic discussions',
    market: 'Marketplace',
    beats: 'Bitcoin Beats',
});

// Admin callables behind each tool. Each one calls requireAdminToolSession.
const GUARDED_CALLABLES = Object.freeze({
    adminSetKillSwitch: 'killSwitch',
    adminListCipherWins: 'cipherWins',
    adminMarkCipherWinPaid: 'cipherWins',
    adminFactionRaceBreakdown: 'factionPrize',
    adminApproveFactionPayout: 'factionPrize',
    banReportedFaucetUser: 'faucetAbuse',
    backfillFactionTotals: 'factionBackfill',
    moderateTopicPost: 'topics',
});

const STEP_UP_MESSAGE = 'Enter a fresh 2FA code to open this admin tool.';

function currentNow() {
    // Tests move this clock. Production never sets it.
    const hook = global.__BTC_MFA_NOW__;
    if (typeof hook === 'function') return hook();
    return Date.now();
}

function isAdminTool(tool) {
    return typeof tool === 'string' && Object.prototype.hasOwnProperty.call(ADMIN_TOOLS, tool);
}

function sessionDocId(uid, tool) {
    return uid + '_' + tool;
}

function sessionFrom(data) {
    const raw = data && typeof data.adminToolSession === 'string' ? data.adminToolSession : '';
    return SESSION_RE.test(raw) ? raw : '';
}

function sameId(a, b) {
    const left = Buffer.from(String(a || ''));
    const right = Buffer.from(String(b || ''));
    if (left.length !== right.length || !left.length) return false;
    return crypto.timingSafeEqual(left, right);
}

function newSessionId() {
    return crypto.randomBytes(16).toString('hex');
}

function stepUpError(HttpsError, tool) {
    const Ctor = HttpsError || functionsV1.https.HttpsError;
    return new Ctor('failed-precondition', STEP_UP_MESSAGE, { reason: 'admin-step-up', tool: tool });
}

// Throws failed-precondition (details.reason 'admin-step-up') unless the
// caller holds a live session for exactly this tool. The caller's own admin
// claim check still runs first in each callable; this is checked again here
// so a missing claim never reaches Firestore.
async function requireAdminToolSession(db, data, context, tool, opts) {
    const o = opts || {};
    const HttpsError = o.HttpsError || functionsV1.https.HttpsError;
    if (!isAdminTool(tool)) throw new HttpsError('internal', 'Unknown admin tool.');
    const auth = context && context.auth;
    if (!auth || !auth.uid) throw new HttpsError('unauthenticated', 'Must be signed in');
    if (!auth.token || auth.token.admin !== true) throw new HttpsError('permission-denied', 'Admin only.');
    const sessionId = sessionFrom(data);
    if (!sessionId) throw stepUpError(HttpsError, tool);
    const nowMs = typeof o.now === 'function' ? o.now() : currentNow();
    const snap = await db.collection(COLLECTION).doc(sessionDocId(auth.uid, tool)).get();
    if (!snap.exists) throw stepUpError(HttpsError, tool);
    const row = snap.data() || {};
    if (row.uid !== auth.uid) throw stepUpError(HttpsError, tool);
    if (row.tool !== tool) throw stepUpError(HttpsError, tool);
    if (row.revoked === true) throw stepUpError(HttpsError, tool);
    if (!sameId(row.sessionId, sessionId)) throw stepUpError(HttpsError, tool);
    if (!(typeof row.verifiedAtMs === 'number' && row.verifiedAtMs <= nowMs + 1000)) throw stepUpError(HttpsError, tool);
    if (!(typeof row.expiresAtMs === 'number' && row.expiresAtMs > nowMs)) throw stepUpError(HttpsError, tool);
    if ((row.expiresAtMs - row.verifiedAtMs) > TOOL_SESSION_TTL_MS) throw stepUpError(HttpsError, tool);
    return { uid: auth.uid, tool: tool, method: row.method || '' };
}

module.exports = {
    COLLECTION: COLLECTION,
    TOOL_SESSION_TTL_MS: TOOL_SESSION_TTL_MS,
    ADMIN_TOOLS: ADMIN_TOOLS,
    GUARDED_CALLABLES: GUARDED_CALLABLES,
    STEP_UP_MESSAGE: STEP_UP_MESSAGE,
    isAdminTool: isAdminTool,
    sessionDocId: sessionDocId,
    sessionFrom: sessionFrom,
    newSessionId: newSessionId,
    requireAdminToolSession: requireAdminToolSession,
};
