#!/usr/bin/env node
/**
 * Read-only look at the last 3 raid boss docs.
 * Prints field names and values. No writes. Emails and full uids are redacted.
 * Long strings are truncated. Auth is Application Default Credentials.
 * No key file is read from the repo.
 *
 *   node scripts/raid-boss-inspect.js
 */
'use strict';

const path = require('path');

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'bitcoin-education-archive';

function loadAdmin() {
    try { return require('firebase-admin'); }
    catch (e) { return require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin')); }
}

function redact(key, value) {
    if (/email|uid/i.test(String(key || ''))) return '[redacted]';
    if (typeof value === 'string' && value.indexOf('@') !== -1) return '[redacted]';
    if (value && typeof value.toDate === 'function') {
        try { return value.toDate().toISOString(); }
        catch (e) { return '[time]'; }
    }
    if (Array.isArray(value)) return '[array ' + value.length + ']';
    if (value && typeof value === 'object') return '[object]';
    if (typeof value === 'string' && value.length > 80) return value.slice(0, 80) + '…';
    return value;
}

async function main() {
    const admin = loadAdmin();
    if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
    const db = admin.firestore();
    const snap = await db.collection('raid_bosses').orderBy('startTime', 'desc').limit(3).get();
    console.log('raid bosses: ' + snap.size);
    snap.forEach(function (doc) {
        const data = doc.data() || {};
        console.log('--- ' + doc.id);
        Object.keys(data).sort().forEach(function (key) {
            console.log(key + ': ' + JSON.stringify(redact(key, data[key])));
        });
    });
}

main().catch(function (err) {
    console.error('Auth or read unavailable. No data was written.');
    process.exit(err && err.code === 7 ? 1 : 1);
});
