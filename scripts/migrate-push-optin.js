#!/usr/bin/env node
/**
 * Keep current push subscribers on after the explicit opt-in switch.
 *
 * A user counts when they have at least one valid registered token and have
 * not set notificationPrefs.master to false. Valid tokens are the device
 * docs under push_tokens/{uid}/devices, the legacy parent token, and the
 * legacy users.fcmToken / users.pushToken fields the sender still reads.
 * A token is valid when it is a string of 20 to 512 characters.
 *
 * Dry-run is the default. It prints counts and uids only. It never prints
 * an address, a token, or a username. Pass --apply to write.
 *
 * --apply sets notificationPrefs.master to true in transactions, 20 users
 * at a time. Each transaction re-reads the user and the token. It does not
 * write when master is already true, when master is false, when the user
 * is banned, or when the token is gone. A second --apply writes nothing.
 * The nested preference map is updated with a dotted field so other
 * category switches stay as they are.
 *
 *   node scripts/migrate-push-optin.js
 *   node scripts/migrate-push-optin.js --apply
 *
 * Auth is Application Default Credentials. No key file is read from the repo.
 */
'use strict';

const path = require('path');

const TOKEN_MIN = 20;
const TOKEN_MAX = 512;
const APPLY_BATCH = 20;
const PAGE_SIZE = 300;
const MAX_DOCS = 100000;
const USER_FIELDS = ['notificationPrefs', 'banned', 'fcmToken', 'pushToken'];
const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'bitcoin-education-archive';

function validPushToken(value) {
    if (typeof value !== 'string') return false;
    if (value.length < TOKEN_MIN || value.length > TOKEN_MAX) return false;
    if (value.trim() !== value) return false;
    if (/[\u0000-\u001F\u007F]/.test(value)) return false;
    return true;
}

function hasValidRegisteredToken(record) {
    const devices = record && record.devices || [];
    for (let i = 0; i < devices.length; i++) {
        const row = devices[i];
        const token = row && typeof row === 'object' ? row.token : row;
        if (validPushToken(token)) return true;
    }
    if (validPushToken(record && record.parentToken)) return true;
    if (validPushToken(record && record.fcmToken)) return true;
    if (validPushToken(record && record.pushToken)) return true;
    return false;
}

function masterOf(user) {
    if (!user || typeof user !== 'object') return undefined;
    const prefs = user.notificationPrefs;
    if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) return undefined;
    if (!Object.prototype.hasOwnProperty.call(prefs, 'master')) return undefined;
    return prefs.master;
}

function buildRecord(input) {
    const user = input && input.user;
    return {
        uid: input && input.uid ? String(input.uid) : '',
        exists: !!user,
        banned: !!(user && user.banned === true),
        master: masterOf(user),
        parentToken: input && input.parent ? input.parent.token : undefined,
        fcmToken: user ? user.fcmToken : undefined,
        pushToken: user ? user.pushToken : undefined,
        devices: input && input.devices || []
    };
}

function classifyUser(record) {
    if (!record || !/^[A-Za-z0-9_-]{1,128}$/.test(record.uid)) return 'skip-invalid';
    if (!hasValidRegisteredToken(record)) return 'skip-no-token';
    if (!record.exists) return 'skip-missing';
    if (record.master === false) return 'skip-opt-out';
    if (record.banned === true) return 'skip-banned';
    if (record.master === true) return 'already';
    return 'write';
}

function indexSubscribers(input) {
    const byUid = new Map();
    function slot(uid) {
        const id = String(uid || '');
        if (!byUid.has(id)) byUid.set(id, { uid: id, user: null, parent: null, devices: [] });
        return byUid.get(id);
    }
    (input && input.tokenDocs || []).forEach(function (doc) {
        slot(doc.id).parent = { token: doc.token };
    });
    const devicesByUid = input && input.devicesByUid || {};
    Object.keys(devicesByUid).forEach(function (uid) {
        slot(uid).devices = devicesByUid[uid] || [];
    });
    (input && input.userDocs || []).forEach(function (doc) {
        slot(doc.id).user = doc.data || null;
    });
    const records = [];
    byUid.forEach(function (row) {
        if (row.user === null && !row.parent && (!row.devices || !row.devices.length)) return;
        records.push(buildRecord(row));
    });
    records.sort(function (a, b) { return a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0; });
    return records;
}

function summarize(records) {
    const counts = {
        eligible: 0,
        already: 0,
        willWrite: 0,
        skipOptOut: 0,
        skipBanned: 0,
        skipMissing: 0,
        skipNoToken: 0,
        skipInvalid: 0
    };
    const uids = [];
    (records || []).forEach(function (record) {
        const action = classifyUser(record);
        if (action === 'write') {
            counts.willWrite++;
            counts.eligible++;
            uids.push(record.uid);
        } else if (action === 'already') {
            counts.already++;
            counts.eligible++;
            uids.push(record.uid);
        } else if (action === 'skip-opt-out') counts.skipOptOut++;
        else if (action === 'skip-banned') counts.skipBanned++;
        else if (action === 'skip-missing') counts.skipMissing++;
        else if (action === 'skip-invalid') counts.skipInvalid++;
        else counts.skipNoToken++;
    });
    uids.sort();
    return { counts: counts, uids: uids };
}

function formatReport(mode, summary) {
    const counts = summary && summary.counts || {};
    const lines = [
        '[migrate-push-optin] mode=' + (mode === 'apply' ? 'apply' : 'dry-run'),
        '[migrate-push-optin] eligible=' + (counts.eligible || 0) +
            ' already=' + (counts.already || 0) +
            ' willWrite=' + (counts.willWrite || 0) +
            ' skipOptOut=' + (counts.skipOptOut || 0) +
            ' skipBanned=' + (counts.skipBanned || 0) +
            ' skipMissing=' + (counts.skipMissing || 0) +
            ' skipNoToken=' + (counts.skipNoToken || 0) +
            ' skipInvalid=' + (counts.skipInvalid || 0),
        '[migrate-push-optin] uids:'
    ];
    (summary && summary.uids || []).forEach(function (uid) {
        if (/^[A-Za-z0-9_-]{1,128}$/.test(uid)) lines.push(uid);
    });
    return lines.join('\n');
}

function parseArgs(argv) {
    const args = argv || [];
    return {
        help: args.indexOf('--help') !== -1 || args.indexOf('-h') !== -1,
        apply: args.indexOf('--apply') !== -1
    };
}

function helpText() {
    return [
        'Usage: node scripts/migrate-push-optin.js [--apply]',
        '',
        'Counts users with a valid registered push token and no explicit opt-out.',
        'Prints counts and uids only. Dry-run is the default.',
        '--apply sets notificationPrefs.master to true for that set.',
        'Users with master === false and banned users are not written.',
        '',
        'Auth: Application Default Credentials.'
    ].join('\n');
}

function publicError(err) {
    return String(err && err.message ? err.message : err || 'error')
        .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[redacted]')
        .slice(0, 180);
}

async function applyUser(db, uid) {
    const userRef = db.collection('users').doc(uid);
    const parentRef = db.collection('push_tokens').doc(uid);
    const devicesRef = parentRef.collection('devices');
    return db.runTransaction(async function (tx) {
        const userSnap = await tx.get(userRef);
        const parentSnap = await tx.get(parentRef);
        const devicesSnap = await tx.get(devicesRef);
        const devices = [];
        if (devicesSnap && typeof devicesSnap.forEach === 'function') {
            devicesSnap.forEach(function (doc) {
                devices.push({ token: typeof doc.get === 'function' ? doc.get('token') : undefined });
            });
        }
        const record = buildRecord({
            uid: uid,
            user: userSnap && userSnap.exists ? (userSnap.data() || {}) : null,
            parent: parentSnap && parentSnap.exists ? { token: parentSnap.get('token') } : null,
            devices: devices
        });
        const action = classifyUser(record);
        if (action !== 'write') return action;
        tx.update(userRef, { 'notificationPrefs.master': true });
        return 'wrote';
    });
}

async function applyWrites(db, uids) {
    const result = { wrote: 0, already: 0, skipped: 0, errors: 0 };
    const list = uids || [];
    for (let i = 0; i < list.length; i += APPLY_BATCH) {
        const slice = list.slice(i, i + APPLY_BATCH);
        const settled = await Promise.all(slice.map(function (uid) {
            return applyUser(db, uid).then(function (action) {
                return { uid: uid, action: action };
            }).catch(function (err) {
                return { uid: uid, action: 'error', message: publicError(err) };
            });
        }));
        settled.forEach(function (row) {
            if (row.action === 'wrote') result.wrote++;
            else if (row.action === 'already') result.already++;
            else if (row.action === 'error') {
                result.errors++;
                console.log('[migrate-push-optin] error uid=' + row.uid + ' ' + row.message);
            } else result.skipped++;
        });
    }
    return result;
}

function loadAdmin() {
    try {
        return require('firebase-admin');
    } catch (err) {
        return require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
    }
}

async function pageDocs(db, admin, name, fields) {
    const out = [];
    let last = null;
    while (out.length < MAX_DOCS) {
        let query = db.collection(name).orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE_SIZE);
        if (fields && fields.length) query = query.select.apply(query, fields);
        if (last) query = query.startAfter(last);
        const snap = await query.get();
        if (snap.empty) break;
        snap.docs.forEach(function (doc) { out.push(doc); });
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE_SIZE) break;
    }
    return out;
}

async function loadRecords(db, admin) {
    const parents = await pageDocs(db, admin, 'push_tokens', []);
    const tokenDocs = [];
    const devicesByUid = {};
    for (let i = 0; i < parents.length; i++) {
        const doc = parents[i];
        tokenDocs.push({ id: doc.id, token: doc.get('token') });
        const devices = await doc.ref.collection('devices').get();
        const rows = [];
        devices.forEach(function (child) {
            rows.push({ token: child.get('token') });
        });
        devicesByUid[doc.id] = rows;
    }
    const users = await pageDocs(db, admin, 'users', USER_FIELDS);
    const userDocs = users.map(function (doc) {
        return { id: doc.id, data: doc.data() || {} };
    });
    return indexSubscribers({ tokenDocs: tokenDocs, devicesByUid: devicesByUid, userDocs: userDocs });
}

async function main() {
    const args = parseArgs(process.argv);
    if (args.help) {
        console.log(helpText());
        return;
    }
    const admin = loadAdmin();
    if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
    const db = admin.firestore();
    const records = await loadRecords(db, admin);
    const summary = summarize(records);
    console.log(formatReport(args.apply ? 'apply' : 'dry-run', summary));
    if (!args.apply) {
        console.log('[migrate-push-optin] dry-run only. Re-run with --apply to set master true for ' + summary.counts.willWrite + ' users.');
        return;
    }
    const pending = records.filter(function (record) { return classifyUser(record) === 'write'; }).map(function (record) { return record.uid; });
    const written = await applyWrites(db, pending);
    console.log('[migrate-push-optin] wrote=' + written.wrote +
        ' already=' + written.already +
        ' skipped=' + written.skipped +
        ' errors=' + written.errors);
}

if (require.main === module) {
    main().then(function () { process.exit(0); }).catch(function (err) {
        console.error('[migrate-push-optin] failed:', publicError(err));
        process.exit(1);
    });
}

module.exports = {
    TOKEN_MIN: TOKEN_MIN,
    TOKEN_MAX: TOKEN_MAX,
    APPLY_BATCH: APPLY_BATCH,
    USER_FIELDS: USER_FIELDS,
    validPushToken: validPushToken,
    hasValidRegisteredToken: hasValidRegisteredToken,
    buildRecord: buildRecord,
    classifyUser: classifyUser,
    indexSubscribers: indexSubscribers,
    summarize: summarize,
    formatReport: formatReport,
    parseArgs: parseArgs,
    publicError: publicError,
    applyUser: applyUser,
    applyWrites: applyWrites
};
