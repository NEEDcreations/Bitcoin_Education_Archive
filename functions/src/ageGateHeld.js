'use strict';

// Admin-only held-account list for the claims age gate (config/ageGateHeld).
// Read with the Admin SDK only. Client writes to config/{docId} are denied
// in firestore.rules. A payout-hold lift does not remove entries from this
// doc. The list is uid-based: linking an email or provider does not change
// the uid, so the account stays held.
//
// Fail-closed: if the doc is missing or cannot be read, callers must refuse
// the claim (retryable). Never treat a failed read as an empty list.
// Successful reads are cached in memory for at most 60 seconds. Failures
// are not cached, so a retry hits Firestore again. At most one read per
// loadHeld call.
//
// Staging-only env overrides (ignored unless the server-derived project id
// is bitcoin-quest-staging; always ignored on bitcoin-education-archive):
//   AGE_GATE_CUTOFF_MS    epoch ms or ISO date, replaces the cutoff
//   AGE_GATE_HELD_EXTRA   comma or space separated uid prefixes to ADD
// Project id comes from GCLOUD_PROJECT, GOOGLE_CLOUD_PROJECT,
// FIREBASE_CONFIG.projectId, or the Admin app options, never request data.

const STAGING_PROJECT = 'bitcoin-quest-staging';
const LIVE_PROJECT = 'bitcoin-education-archive';
const DOC_COLLECTION = 'config';
const DOC_ID = 'ageGateHeld';
const CACHE_MS = 60 * 1000;
const REAL_ACCOUNT_CUTOFF_MS = Date.parse('2026-11-28T05:00:00.000Z');

let cache = { at: 0, value: null };

function projectId() {
    if (process.env.GCLOUD_PROJECT) return String(process.env.GCLOUD_PROJECT);
    if (process.env.GOOGLE_CLOUD_PROJECT) return String(process.env.GOOGLE_CLOUD_PROJECT);
    try {
        const cfg = JSON.parse(process.env.FIREBASE_CONFIG || '{}');
        if (cfg && cfg.projectId) return String(cfg.projectId);
    } catch (e) { /* fall through */ }
    try {
        const admin = require('firebase-admin');
        const app = admin.apps && admin.apps[0];
        if (app && app.options && app.options.projectId) return String(app.options.projectId);
    } catch (e) { /* fall through */ }
    return '';
}

function isStagingProject() {
    return projectId() === STAGING_PROJECT;
}

function cutoffMs() {
    if (isStagingProject()) {
        const raw = process.env.AGE_GATE_CUTOFF_MS;
        if (raw != null && String(raw).trim()) {
            const n = Number(raw);
            if (Number.isFinite(n) && n > 0) return n;
            const parsed = Date.parse(String(raw));
            if (Number.isFinite(parsed)) return parsed;
        }
    }
    return REAL_ACCOUNT_CUTOFF_MS;
}

function stagingExtraPrefixes() {
    if (!isStagingProject()) return [];
    const raw = process.env.AGE_GATE_HELD_EXTRA;
    if (!raw) return [];
    return String(raw).split(/[\s,]+/).map(function (s) { return s.trim(); }).filter(Boolean);
}

function addUid(set, value) {
    const id = String(value || '').trim();
    if (id) set.add(id);
}

// Parse a config/ageGateHeld document body. Returns { ok, uids, groups } or
// { ok: false, reason }. An existing doc with empty lists is valid (no one
// held). A missing field is treated as empty, not as a failed read.
function parseHeldDoc(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return { ok: false, reason: 'unreadable' };
    }
    if (data.uids != null && !Array.isArray(data.uids)) {
        return { ok: false, reason: 'unreadable' };
    }
    if (data.groups != null && (typeof data.groups !== 'object' || Array.isArray(data.groups))) {
        return { ok: false, reason: 'unreadable' };
    }
    const uids = new Set();
    const groups = {};
    if (Array.isArray(data.uids)) {
        data.uids.forEach(function (id) { addUid(uids, id); });
    }
    if (data.groups) {
        Object.keys(data.groups).forEach(function (g) {
            const rows = data.groups[g];
            if (rows != null && !Array.isArray(rows)) return;
            const list = [];
            (rows || []).forEach(function (id) {
                const s = String(id || '').trim();
                if (!s) return;
                uids.add(s);
                list.push(s);
            });
            groups[g] = list;
        });
    }
    return { ok: true, uids: uids, groups: groups };
}

function groupOf(uid, held) {
    const id = String(uid || '');
    if (!id || !held || !held.groups) return null;
    const names = Object.keys(held.groups);
    for (let i = 0; i < names.length; i++) {
        const rows = held.groups[names[i]] || [];
        if (rows.indexOf(id) !== -1) return names[i];
    }
    return null;
}

function isHeldUid(uid, held) {
    const id = String(uid || '');
    if (!id) return false;
    if (held && held.ok !== false && held.uids && typeof held.uids.has === 'function' && held.uids.has(id)) {
        return true;
    }
    const extras = stagingExtraPrefixes();
    for (let i = 0; i < extras.length; i++) {
        if (extras[i] && id.startsWith(extras[i])) return true;
    }
    return false;
}

function resetCache() {
    cache = { at: 0, value: null };
}

async function loadHeld(db) {
    const now = Date.now();
    if (cache.value && cache.value.ok && (now - cache.at) < CACHE_MS && cache.value.uids) {
        return cache.value;
    }
    if (!db || typeof db.collection !== 'function') {
        return { ok: false, reason: 'unreadable' };
    }
    try {
        const snap = await db.collection(DOC_COLLECTION).doc(DOC_ID).get();
        if (!snap || snap.exists !== true) return { ok: false, reason: 'missing' };
        const parsed = parseHeldDoc(snap.data() || {});
        if (!parsed.ok) return { ok: false, reason: parsed.reason || 'unreadable' };
        const value = { ok: true, uids: parsed.uids, groups: parsed.groups };
        cache = { at: now, value: value };
        return value;
    } catch (e) {
        return { ok: false, reason: 'unreadable' };
    }
}

module.exports = {
    STAGING_PROJECT: STAGING_PROJECT,
    LIVE_PROJECT: LIVE_PROJECT,
    DOC_COLLECTION: DOC_COLLECTION,
    DOC_ID: DOC_ID,
    CACHE_MS: CACHE_MS,
    REAL_ACCOUNT_CUTOFF_MS: REAL_ACCOUNT_CUTOFF_MS,
    projectId: projectId,
    isStagingProject: isStagingProject,
    cutoffMs: cutoffMs,
    stagingExtraPrefixes: stagingExtraPrefixes,
    parseHeldDoc: parseHeldDoc,
    groupOf: groupOf,
    isHeldUid: isHeldUid,
    loadHeld: loadHeld,
    resetCache: resetCache,
};
