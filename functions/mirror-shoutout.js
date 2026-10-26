#!/usr/bin/env node
'use strict';

// Admin-only backfill: mirror one existing Nacho shoutout to Telegram.
// Dry-run is the default. Nothing is sent unless --apply is passed.
//
//   node functions/mirror-shoutout.js shoutout_gift_<giftId>
//   node functions/mirror-shoutout.js shoutout_gift_<giftId> --apply
//
// Requires Application Default Credentials and ADMIN_TOKEN in the environment.
// The token is never sent or printed. --apply also needs BRIDGE_SECRET.
// BRIDGE_URL is optional. Secrets, URL query strings, and bridge response
// bodies are not printed.

const path = require('path');
const {
    mirrorShoutoutOnce,
    buildNachoBridgePayload,
    shouldMirrorShoutout,
} = require('./src/telegramBridge');
const { moderateText } = require('./src/moderateText');

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'bitcoin-education-archive';

function parseArgs(argv) {
    const args = argv || [];
    let apply = false;
    let id = '';
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--apply') apply = true;
        else if (arg === '--') continue;
        else if (arg.startsWith('-')) throw new Error('Unknown flag: ' + arg);
        else if (!id) id = arg;
        else throw new Error('Unexpected argument: ' + arg);
    }
    return { apply: apply, id: id };
}

function filterResult(text, payloadText) {
    const verdict = moderateText(text || '', { strict: true });
    const sent = moderateText(payloadText || '', { strict: true });
    if (verdict.clean && sent.clean) return 'clean';
    const reason = !verdict.clean ? verdict.reason : sent.reason;
    return String(reason || '').indexOf('scam') !== -1 ? 'scam' : 'profanity';
}

function isShoutoutDoc(id, data) {
    const clean = String(id || '');
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(clean)) return false;
    if (clean.indexOf('shoutout_') !== 0) return false;
    return !!(data && data.uid === 'nacho-bot');
}

function loadAdmin() {
    const local = path.join(__dirname, 'node_modules', 'firebase-admin');
    try {
        return require('firebase-admin');
    } catch (err) {
        try {
            return require(local);
        } catch (err2) {
            console.error('[mirror-shoutout] firebase-admin is not installed. From the repo root: cd functions && npm install');
            process.exit(1);
        }
    }
}

async function main() {
    let parsed;
    try {
        parsed = parseArgs(process.argv.slice(2));
    } catch (err) {
        console.error('[mirror-shoutout] ' + err.message);
        process.exit(1);
    }
    if (!parsed.id) {
        console.error('Usage: node functions/mirror-shoutout.js <chatMessageId> [--apply]');
        process.exit(1);
    }
    if (!process.env.ADMIN_TOKEN) {
        console.error('[mirror-shoutout] ADMIN_TOKEN is not set. This script is admin-only.');
        process.exit(1);
    }

    const admin = loadAdmin();
    if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
    const db = admin.firestore();
    const snap = await db.collection('global_chat').doc(parsed.id).get();
    if (!snap.exists) {
        console.error('[mirror-shoutout] no global_chat doc ' + parsed.id);
        process.exit(1);
    }
    const data = snap.data() || {};
    if (!isShoutoutDoc(parsed.id, data)) {
        console.error('[mirror-shoutout] ' + parsed.id + ' is not a Nacho shoutout');
        process.exit(1);
    }

    const payload = buildNachoBridgePayload(data.text || '');
    console.log('[mirror-shoutout] project=' + PROJECT_ID + ' mode=' + (parsed.apply ? 'apply' : 'dry-run') + ' id=' + parsed.id);
    console.log('[mirror-shoutout] telegram user=' + payload.user + ' source=' + payload.source + ' uid=' + payload.uid);
    console.log('[mirror-shoutout] text=' + payload.text);
    const filter = filterResult(data.text || '', payload.text);
    console.log('[mirror-shoutout] filter=' + filter);
    if (!shouldMirrorShoutout(data)) {
        console.log('[mirror-shoutout] already mirrored (telegramMsgId or telegramMirrored). Nothing to do.');
        process.exit(0);
    }
    if (!parsed.apply) {
        console.log('[mirror-shoutout] dry-run. Re-run with --apply to post once.');
        process.exit(0);
    }
    if (!process.env.BRIDGE_SECRET) {
        console.error('[mirror-shoutout] BRIDGE_SECRET is not set.');
        process.exit(1);
    }

    const result = await mirrorShoutoutOnce({
        db: db,
        docId: parsed.id,
        collection: 'global_chat',
        text: data.text,
        force: true,
    });
    if (!result.mirrored) {
        console.error('[mirror-shoutout] not mirrored (' + (result.reason || 'failed') + ').');
        process.exit(1);
    }
    console.log('[mirror-shoutout] mirrored telegramMsgId=' + result.telegramMsgId);
    process.exit(0);
}

if (require.main === module) {
    main().catch(function(err) {
        console.error('[mirror-shoutout] ' + (err && err.message ? err.message : 'failed'));
        process.exit(1);
    });
}

module.exports = {
    parseArgs: parseArgs,
    isShoutoutDoc: isShoutoutDoc,
    filterResult: filterResult,
};
