'use strict';

// Shared helpers for the age-gate held seed and release scripts.
// The only accepted file shape is a JSON array of distinct, non-empty
// uid strings. Objects, text lists, wrappers, blanks, non-strings, and
// duplicates are rejected. Counts are the unique (and only) length of
// that array: there is no silent dedupe.
//
// --apply must pass --expect-count=<n> equal to that total (the number
// printed by the dry run). A mismatch or a missing flag refuses the
// write, so a file that changed after the dry run cannot be applied.
//
// Staging is derived only from --project=bitcoin-quest-staging, never
// from environment variables.

const STAGING_PROJECT = 'bitcoin-quest-staging';

function isStagingProject(project) {
    return project === STAGING_PROJECT;
}

function parseUidArrayText(raw) {
    const trimmed = String(raw || '').replace(/^\uFEFF/, '').trim();
    if (!trimmed) return { ok: false, reason: 'empty_file' };
    let data;
    try { data = JSON.parse(trimmed); } catch (e) { return { ok: false, reason: 'invalid_json' }; }
    if (!Array.isArray(data)) return { ok: false, reason: 'not_uid_array' };
    if (data.length === 0) return { ok: false, reason: 'empty_list' };
    const uids = [];
    const seen = new Set();
    for (let i = 0; i < data.length; i++) {
        const v = data[i];
        if (typeof v !== 'string' || v.length === 0 || v.trim() !== v) {
            return { ok: false, reason: 'invalid_uid' };
        }
        if (seen.has(v)) return { ok: false, reason: 'duplicate_uids' };
        seen.add(v);
        uids.push(v);
    }
    return { ok: true, uids: uids, total: uids.length, doc: { uids: uids.slice() } };
}

function parseUidArrayFile(filePath) {
    const fs = require('fs');
    return parseUidArrayText(fs.readFileSync(filePath, 'utf8'));
}

function parseExpectCount(argv) {
    let raw = null;
    (argv || []).forEach(function (a) {
        const m = /^--expect-count=(\d+)$/.exec(String(a));
        if (m) raw = m[1];
    });
    if (raw == null) return { present: false, value: null };
    if (!/^[1-9][0-9]*$/.test(raw)) return { present: true, ok: false, value: null };
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) return { present: true, ok: false, value: null };
    return { present: true, ok: true, value: n };
}

function checkExpectCount(expect, total) {
    if (!expect || !expect.present) return { ok: false, reason: 'missing_expect_count' };
    if (expect.ok === false) return { ok: false, reason: 'invalid_expect_count' };
    if (expect.value !== total) return { ok: false, reason: 'count_mismatch' };
    return { ok: true };
}

// Initialize the same way functions/src/firebaseAdmin.js does. Do not
// read admin.apps.length: on firebase-admin 14 that property can be
// undefined and throws. Prefer getApps() from firebase-admin/app, or a
// provided getApps.
function ensureFirestore(adminMod, projectId) {
    var already = 0;
    if (adminMod && typeof adminMod.getApps === 'function') {
        already = adminMod.getApps().length;
    } else if (adminMod && adminMod.apps) {
        already = adminMod.apps.length || 0;
    } else {
        try {
            var appMod = require('firebase-admin/app');
            already = appMod.getApps().length;
        } catch (e) {
            already = 0;
        }
    }
    if (!already) adminMod.initializeApp({ projectId: projectId });
    return adminMod.firestore();
}

function refuse(message) {
    const e = new Error(message);
    e.exitCode = 2;
    throw e;
}

module.exports = {
    STAGING_PROJECT: STAGING_PROJECT,
    isStagingProject: isStagingProject,
    parseUidArrayText: parseUidArrayText,
    parseUidArrayFile: parseUidArrayFile,
    parseExpectCount: parseExpectCount,
    checkExpectCount: checkExpectCount,
    ensureFirestore: ensureFirestore,
    refuse: refuse,
};
