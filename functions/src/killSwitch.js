'use strict';

// App-wide kill switch.
//
// One Firestore doc, config/killSwitch, says whether Bitcoin Quest is offline.
// Clients may read it (the maintenance page needs it before sign-in). Only the
// adminSetKillSwitch callable writes it, through the Admin SDK. Firestore
// rules deny every client write. Audit rows in kill_switch_audit are
// append-only: this module never deletes them.
//
// Doc shape:
//   enabled         boolean
//   mode            'offline'
//   reason          string    admin's note (admins only)
//   autoReenableAt  Timestamp|null
//   since           Timestamp when it was last turned on
//   updatedAt       Timestamp
//   updatedBy       uid
//   snapshot        { operationName, outputUri, startedAt, status, error }
//
// "Effective ON" = enabled && (no autoReenableAt || now < autoReenableAt).
// Auto re-enable needs no scheduler: every reader computes it from the time.
//
// Shutdown order (must never change):
//   1. Flip the flag so the app stops right away.
//   2. Start a managed Firestore export in the background to
//      gs://<backup-bucket>/kill-switch/<timestamp>/.
//   A failed snapshot never undoes or delays the shutdown.
//
// Fail-safe:
//   * Server gates FAIL CLOSED. If the doc can't be read they refuse.
//   * The web client FAILS OPEN (see /kill-switch.js). A Firestore hiccup
//     must not brick the app; the server gates still hold.
//   * Admins can still open Admin tools and turn the switch off.

const KILL_SWITCH_COLLECTION = 'config';
const KILL_SWITCH_DOC_ID = 'killSwitch';
const AUDIT_COLLECTION = 'kill_switch_audit';
const RATE_COLLECTION = 'kill_switch_rate';
const OFFLINE_MESSAGE = 'Bitcoin Quest is temporarily offline for maintenance.';
const CONFIRM_ON = 'OFFLINE';
const CONFIRM_OFF = 'ONLINE';
const MAX_REASON = 200;
const MIN_REASON = 8;
const MIN_REENABLE_MIN = 5;
const MAX_REENABLE_MIN = 7 * 24 * 60;
const GATE_CACHE_MS = 5000;
const BACKUP_BUCKET_DEFAULT = 'bitcoin-education-archive-backups';
const BACKUP_MAX_AGE_HOURS = 26;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX_USER = 8;
const RATE_MAX_GLOBAL = 20;
const RATE_MAX_STATUS_USER = 30;
const SNAPSHOT_REUSE_MS = 6 * 60 * 60 * 1000;
const KILL_SWITCH_ADMIN_DOC_ID = 'killSwitchAdmin';

// Functions that move sats, or grant XP / points / tickets / badges, plus
// scheduled jobs that pay out. Each is wrapped by gateExports() in index.js.
// While the switch is ON, callables return 503 and schedules skip (200) so
// the period's prizes are postponed, not paid. Catch-up is in the runbook.
const GATED = Object.freeze({
    payouts: Object.freeze([
        'claimSats',
        'claimCipherSats',
        'claimCipherWin',
        'adminResolveCipherSatsClaim',
        'adminMarkCipherWinPaid',
        'adminApproveFactionPayout',
        'confirmTipSent',
        'tctvDripCheckin',
        'tctvDripTick',
        'payQualifiedReferrals',
        'payWeeklyPredictors',
        'payMonthlyPredictors',
        'payWeeklyQuestLB',
        'payMonthlyQuestLB',
        'monthlyRaffleDraw',
        'resetWeeklyXP',
        'resetMonthlyXP',
        'creditMatureTopicComments',
    ]),
    rewards: Object.freeze([
        'awardPoints',
        'dailySpin',
        'useBonusSpin',
        'awardDailyGifts',
        'openGift',
        'claimSayHi',
        'claimReplyBonus',
        'claimOnboardingQuestStep',
        'claimNachoChatTicket',
        'answerTrivia',
        'gradeQuest',
        'gradeScholarExam',
        'issueCertificate',
        'contributeFavor',
        'hashForFavor',
        'contributeRaid',
        'donatePoints',
        'convertPointsToTickets',
        'recordDailyVisit',
        'sendKeys',
        'spendTickets',
        'spendTicketsForFreeze',
        'activateDoubleXP',
        'syncUserFactionPoints',
        'verifyReferral',
        'registerReferral',
        'pvpSubmitAnswer',
        'pvpTimeoutOpponent',
        'resetLightningAddressOnce',
        'tctvWatchHeartbeat',
        'syncStravaWalks',
        'activateHashBooster',
        'useHintToken',
        'mergeAnonBadges',
        'incrementWeeklyChallenge',
        'dailyPollVote',
        'pollVote',
        'chooseFaction',
    ]),
    // Scheduled jobs that should skip (not fail) while offline. Queued work
    // stays in place and is flushed after the switch is off.
    skips: Object.freeze([
        'flushBadgeGgBursts',
        'reconcileDailyProofs',
        'scheduleRaidForumCredit',
    ]),
    // Firestore triggers cannot be wrapped by gateExport. Each of these has
    // an in-body killSwitchIsOn()/isOffline() check (defer with retry, or skip).
    triggers: Object.freeze([
        'onArticlePublishXp',
        'onBadgeAwardCreated',
        'onPvpMatchFinished',
        'pvpResolveRound',
        'onUserReferral',
        'onChatBadgeCount',
        'onDmBadgeCount',
        'onForumPostBadgeCount',
        'onForumReplyBadgeCount',
        'onBeatsUploadBadgeCount',
        'onArticleBadgeCount',
        'onMarketplaceSaleCount',
    ]),
});

function gatedNames() { return GATED.payouts.concat(GATED.rewards, GATED.skips || []); }
function gatedTriggerNames() { return (GATED.triggers || []).slice(); }

function toMillis(v) {
    if (v == null) return null;
    if (typeof v === 'number') return v;
    if (v instanceof Date) return v.getTime();
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v.seconds === 'number') return v.seconds * 1000;
    if (typeof v._seconds === 'number') return v._seconds * 1000;
    if (typeof v._ms === 'number') return v._ms;
    return null;
}

function effectiveOn(data, nowMs) {
    if (!data || data.enabled !== true) return false;
    const until = toMillis(data.autoReenableAt);
    if (until != null && (nowMs == null ? Date.now() : nowMs) >= until) return false;
    return true;
}

// A later auto-return: a later deadline, or dropping the deadline
// (indefinite). Moving from indefinite to a finite time, or keeping the
// same deadline, is not later — that would be a silent re-arm or a shorten.
function isLaterAutoReturn(oldUntil, newUntil) {
    if (oldUntil == null) return false;
    if (newUntil == null) return true;
    return newUntil > oldUntil;
}

function docRef(db) { return db.collection(KILL_SWITCH_COLLECTION).doc(KILL_SWITCH_DOC_ID); }
function adminDocRef(db) { return db.collection(KILL_SWITCH_COLLECTION).doc(KILL_SWITCH_ADMIN_DOC_ID); }

// Fail closed: if the flag can't be read, treat the app as offline so
// value-granting triggers do not pay or grant.
async function isOffline(db, nowFn) {
    const t = (nowFn || Date.now)();
    try {
        const snap = await docRef(db).get();
        return effectiveOn(snap.exists ? (snap.data() || {}) : null, t);
    } catch (e) {
        return true;
    }
}

function reuseRecentSnapshot(adminData, nowMs) {
    const snap = adminData && adminData.snapshot;
    if (!snap || !snap.operationName) return null;
    if (snap.status === 'START_FAILED') return null;
    const started = toMillis(snap.startedAt);
    if (started == null || (nowMs - started) > SNAPSHOT_REUSE_MS) return null;
    return snap;
}

function makeReader(getDb, opts) {
    const o = opts || {};
    const cacheMs = o.cacheMs == null ? GATE_CACHE_MS : o.cacheMs;
    const now = o.now || Date.now;
    let cached = null;
    return async function readState() {
        const t = now();
        if (cached && t - cached.at < cacheMs) return { on: effectiveOn(cached.data, t), data: cached.data };
        const snap = await docRef(getDb()).get();
        const data = snap.exists ? (snap.data() || {}) : null;
        cached = { at: t, data: data };
        return { on: effectiveOn(data, t), data: data };
    };
}

async function gateReason(readState) {
    try {
        const st = await readState();
        return st.on ? 'kill_switch_on' : null;
    } catch (e) {
        return 'kill_switch_unreadable';
    }
}

function unavailableError(HttpsError) {
    return new HttpsError('unavailable', OFFLINE_MESSAGE);
}

function gateExport(fn, opts) {
    if (typeof fn !== 'function') throw new Error('gateExport: not a function');
    const o = opts || {};
    const readState = o.readState;
    const HttpsError = o.HttpsError;
    const name = o.name || fn.name || 'fn';
    const ep = fn.__endpoint || {};
    const kind = ep.scheduleTrigger ? 'schedule' : (ep.callableTrigger ? 'callable' : 'other');
    if (kind === 'other') throw new Error('gateExport: only callables and schedules are gated (' + name + ')');
    const onSkip = typeof o.onSkip === 'function' ? o.onSkip : null;

    const wrapped = async function (req, res) {
        if (kind === 'callable' && req && req.method === 'OPTIONS') return fn(req, res);
        const why = await gateReason(readState);
        if (!why) return fn(req, res);
        console.warn('[KILL SWITCH] refused ' + name + ' (' + why + ')');
        if (kind === 'schedule') {
            if (onSkip) { try { await onSkip(name, why); } catch (e) { /* best effort */ } }
            if (res && typeof res.status === 'function') {
                res.status(200).send('skipped: kill switch');
                return;
            }
            return;
        }
        const origin = req && req.headers ? req.headers.origin : null;
        if (origin && res && typeof res.set === 'function') {
            res.set('Access-Control-Allow-Origin', origin);
            res.set('Vary', 'Origin');
        }
        if (res && typeof res.status === 'function') {
            res.status(503).json({ error: { status: 'UNAVAILABLE', message: OFFLINE_MESSAGE } });
            return;
        }
        throw unavailableError(HttpsError);
    };
    Object.getOwnPropertyNames(fn).forEach(function (k) {
        if (k === 'length' || k === 'name' || k === 'prototype' || k === 'run') return;
        const d = Object.getOwnPropertyDescriptor(fn, k);
        if (d) Object.defineProperty(wrapped, k, d);
    });
    if (typeof fn.run === 'function') {
        wrapped.run = async function () {
            const why = await gateReason(readState);
            if (why) {
                if (kind === 'schedule') {
                    if (onSkip) { try { await onSkip(name, why); } catch (e) { /* best effort */ } }
                    return { skipped: true, why: why };
                }
                throw unavailableError(HttpsError);
            }
            return fn.run.apply(fn, arguments);
        };
    }
    Object.defineProperty(wrapped, 'name', { value: name, configurable: true });
    Object.defineProperty(wrapped, '__bqKillSwitchGate', { value: kind, enumerable: false });
    return wrapped;
}

function gateExports(target, names, opts) {
    names.forEach(function (n) {
        if (typeof target[n] !== 'function') throw new Error('gateExports: missing export ' + n);
        target[n] = gateExport(target[n], Object.assign({}, opts, { name: n }));
    });
    return target;
}

// ---------------------------------------------------------------- backups

function utcDateKey(ms) { return new Date(ms).toISOString().slice(0, 10); }

function snapshotFolderStamp(ms) {
    return new Date(ms).toISOString().replace(/[:.]/g, '').replace(/000Z$/, 'Z');
}

// Quick backup check before going offline. Read-only and bounded.
// A stale or missing required backup is a WARNING, never a block: the
// confirm screen shows it, and the admin may override. An emergency
// shutdown must never be blocked by a backup check.
// Required: latest managed Firestore export under ~26h old, and PITR on.
// R2 is included only when it can be checked.
async function backupPreflight(deps) {
    const d = deps || {};
    const now = (d.now || Date.now)();
    const maxAgeMs = BACKUP_MAX_AGE_HOURS * 3600 * 1000;
    const checks = [];

    try {
        const days = [utcDateKey(now), utcDateKey(now - 86400000)];
        let found = null;
        for (let i = 0; i < days.length && !found; i++) {
            const meta = await d.findExportMetadata(days[i]);
            if (meta) found = meta;
        }
        const age = found && found.updatedMs ? now - found.updatedMs : null;
        checks.push({
            id: 'firestoreExport', label: 'Firestore daily export',
            ok: !!found && age != null && age >= 0 && age <= maxAgeMs,
            detail: found ? ('Latest export finished ' + Math.round(age / 3600000) + 'h ago') : 'No finished export in the last 2 days',
        });
    } catch (e) {
        checks.push({ id: 'firestoreExport', label: 'Firestore daily export', ok: false, detail: 'Could not list the backups bucket' });
    }

    try {
        const pitr = await d.readPitr();
        checks.push({
            id: 'pitr', label: 'Firestore point-in-time recovery',
            ok: pitr === 'POINT_IN_TIME_RECOVERY_ENABLED',
            detail: pitr === 'POINT_IN_TIME_RECOVERY_ENABLED' ? 'On (7-day rollback)' : 'Off',
        });
    } catch (e) {
        checks.push({ id: 'pitr', label: 'Firestore point-in-time recovery', ok: false, detail: 'Could not read database settings' });
    }

    // R2, Auth, and Storage: only fail when a status (or live listing) is
    // checkable and stale. If the check is not available, skip — do not
    // force an override on every shutdown.
    async function optionalStatus(id, label, missingDetail, lister) {
        try {
            if (typeof lister === 'function') {
                const newest = await lister();
                if (newest && newest.updatedMs) {
                    const age = now - newest.updatedMs;
                    checks.push({
                        id: id, label: label,
                        ok: age >= 0 && age <= maxAgeMs,
                        detail: 'Newest object ' + Math.round(age / 3600000) + 'h ago',
                    });
                    return;
                }
            }
            const st = d.readBackupStatus ? await d.readBackupStatus(id) : null;
            const at = st ? toMillis(st.lastSuccessAt) : null;
            const age = at != null ? now - at : null;
            if (at == null) {
                checks.push({ id: id, label: label, ok: true, skipped: true, detail: missingDetail });
            } else {
                checks.push({
                    id: id, label: label,
                    ok: age >= 0 && age <= maxAgeMs,
                    detail: 'Last good copy ' + Math.round(age / 3600000) + 'h ago',
                });
            }
        } catch (e) {
            checks.push({ id: id, label: label, ok: true, skipped: true, detail: 'Could not check (' + missingDetail + ')' });
        }
    }

    await optionalStatus('r2', 'Cloudflare R2 copy', 'Not checkable from this function (R2 copy runs in GitHub Actions). Check the r2-nightly-backup workflow.', d.findNewestR2);
    await optionalStatus('auth', 'Auth (accounts) backup', 'Not set up yet (daily encrypted Auth copy, PR #290)', null);
    await optionalStatus('storage', 'Storage (files) backup', 'Storage mirror is not set up', null);

    const required = checks.filter(function (c) { return !c.skipped; });
    return {
        ok: required.every(function (c) { return c.ok; }),
        checks: checks,
        checkedAt: now,
    };
}

function makeBackupDeps(admin, db, opts) {
    const o = opts || {};
    const project = o.projectId || process.env.GCLOUD_PROJECT || 'bitcoin-education-archive';
    const bucketName = o.backupBucket || (project + '-backups');
    return {
        projectId: project,
        backupBucket: bucketName,
        findExportMetadata: async function (day) {
            const [files] = await admin.storage().bucket(bucketName).getFiles({ prefix: day + '/', maxResults: 50, autoPaginate: false });
            const meta = (files || []).find(function (f) { return /\.overall_export_metadata$/.test(f.name); });
            if (!meta) return null;
            const upd = meta.metadata && (meta.metadata.updated || meta.metadata.timeCreated);
            return { name: meta.name, updatedMs: upd ? Date.parse(upd) : null };
        },
        readPitr: async function () {
            const token = await admin.app().options.credential.getAccessToken();
            const res = await fetch('https://firestore.googleapis.com/v1/projects/' + project + '/databases/(default)', {
                headers: { Authorization: 'Bearer ' + token.access_token },
            });
            if (!res.ok) throw new Error('pitr ' + res.status);
            const body = await res.json();
            return body.pointInTimeRecoveryEnablement || 'POINT_IN_TIME_RECOVERY_DISABLED';
        },
        readBackupStatus: async function (id) {
            const snap = await db.collection('backup_status').doc(id).get();
            return snap.exists ? snap.data() : null;
        },
        startExport: async function (folder, manifest) {
            const token = await admin.app().options.credential.getAccessToken();
            const outputUriPrefix = 'gs://' + bucketName + '/' + folder;
            const res = await fetch(
                'https://firestore.googleapis.com/v1/projects/' + project + '/databases/(default):exportDocuments',
                {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer ' + token.access_token,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ outputUriPrefix: outputUriPrefix }),
                }
            );
            const result = await res.json();
            if (result.error) {
                const err = new Error(result.error.message || 'export failed');
                err.payload = result.error;
                throw err;
            }
            try {
                // Create-only: ifGenerationMatch 0 refuses an overwrite.
                // The folder stamp is unique, and this SA cannot delete or
                // overwrite existing nightlies (objectCreator + objectViewer).
                const file = admin.storage().bucket(bucketName).file(folder + '/kill-switch-manifest.json');
                await file.save(JSON.stringify(manifest, null, 2), {
                    contentType: 'application/json',
                    precondition: { ifGenerationMatch: 0 },
                });
            } catch (e) {
                console.warn('[KILL SWITCH] manifest write failed');
            }
            return { operationName: result.name || null, outputUriPrefix: outputUriPrefix };
        },
        readExportOperation: async function (operationName) {
            if (!operationName) return null;
            const token = await admin.app().options.credential.getAccessToken();
            const res = await fetch('https://firestore.googleapis.com/v1/' + operationName, {
                headers: { Authorization: 'Bearer ' + token.access_token },
            });
            if (!res.ok) throw new Error('operation ' + res.status);
            return res.json();
        },
    };
}

// ---------------------------------------------------------------- callable helpers

function maskUid(uid) {
    const s = String(uid || '');
    return s ? s.slice(0, 4) + '\u2026' : 'unknown';
}

function cleanReason(raw) {
    if (raw == null) return '';
    // eslint-disable-next-line no-control-regex
    return String(raw).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_REASON);
}

function parseReenable(raw) {
    if (raw == null || raw === '' || raw === 0) return null;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < MIN_REENABLE_MIN || n > MAX_REENABLE_MIN) return NaN;
    return n;
}

function alertText(action, uid, reason, autoMs, override, preflight) {
    if (action === 'on') {
        let t = 'Bitcoin Quest is offline. An admin turned the kill switch on (admin ' + maskUid(uid) + ').';
        if (reason) t += ' Reason: ' + reason + '.';
        t += autoMs ? (' It comes back on its own at ' + new Date(autoMs).toISOString().replace('.000Z', 'Z') + '.') : ' No auto-return is set.';
        if (override) t += ' The backup check failed and was overridden (' + (preflight && preflight.checks ? preflight.checks.filter(function (c) { return !c.ok; }).map(function (c) { return c.label; }).join(', ') : '') + ').';
        t += ' If this was not you or a partner, open Admin tools > Kill switch and turn it off, then lock that admin account.';
        return t;
    }
    let t = 'Bitcoin Quest is back online. An admin turned the kill switch off (admin ' + maskUid(uid) + ').';
    if (reason) t += ' Note: ' + reason + '.';
    return t;
}

function extendAlertText(uid, reason, autoMs, prevAutoMs) {
    let t = 'Bitcoin Quest is still offline. An admin changed the kill switch (admin ' + maskUid(uid) + ').';
    if (reason) t += ' Reason: ' + reason + '.';
    if (autoMs) t += ' Auto-return is now ' + new Date(autoMs).toISOString().replace('.000Z', 'Z') + '.';
    else t += ' Auto-return was removed; it stays off until an admin turns it on.';
    if (prevAutoMs) t += ' It was previously ' + new Date(prevAutoMs).toISOString().replace('.000Z', 'Z') + '.';
    return t;
}

function autoReturnAlertText(reason, untilMs) {
    let t = 'Bitcoin Quest is back online. The kill switch auto-return time was reached';
    if (untilMs) t += ' at ' + new Date(untilMs).toISOString().replace('.000Z', 'Z');
    t += '.';
    if (reason) t += ' It had been on for: ' + reason + '.';
    return t;
}

function publicState(data, nowMs) {
    const on = effectiveOn(data, nowMs);
    return {
        on: on,
        mode: data && data.mode ? data.mode : 'offline',
        message: on ? OFFLINE_MESSAGE : null,
        since: data && data.since ? toMillis(data.since) : null,
        autoReenableAt: data && data.autoReenableAt ? toMillis(data.autoReenableAt) : null,
    };
}

function adminState(data, nowMs) {
    const snap = data && data.snapshot ? data.snapshot : null;
    return {
        reason: data && data.reason ? data.reason : null,
        updatedBy: data && data.updatedBy ? maskUid(data.updatedBy) : null,
        updatedAt: data && data.updatedAt ? toMillis(data.updatedAt) : null,
        snapshot: snap ? {
            operationName: snap.operationName || null,
            outputUri: snap.outputUri || null,
            startedAt: toMillis(snap.startedAt) || snap.startedAt || null,
            status: snap.status || null,
            error: snap.error || null,
        } : null,
    };
}

function takeRate(tx, snap, now, max) {
    const ref = snap.ref;
    let count = 0;
    let windowStart = now;
    if (snap.exists) {
        const row = snap.data() || {};
        const ws = typeof row.windowStartMs === 'number' ? row.windowStartMs : 0;
        if (ws && (now - ws) < RATE_WINDOW_MS) {
            count = row.count || 0;
            windowStart = ws;
            if (count >= max) return false;
        }
    }
    tx.set(ref, { count: count + 1, windowStartMs: windowStart, updatedAtMs: now });
    return true;
}

async function maybeRefreshSnapshot(db, admin, backupDeps, data, nowFn) {
    const snap = data && data.snapshot;
    if (!snap || !snap.operationName) return data && data.snapshot ? data.snapshot : null;
    if (snap.status === 'SUCCESS' || snap.status === 'FAILED' || snap.status === 'START_FAILED') return snap;
    if (typeof backupDeps.readExportOperation !== 'function') return snap;
    try {
        const op = await backupDeps.readExportOperation(snap.operationName);
        let status = snap.status || 'STARTED';
        let error = snap.error || null;
        if (op && op.done) {
            if (op.error) {
                status = 'FAILED';
                error = String(op.error.message || op.error.status || 'export failed').slice(0, 300);
            } else {
                status = 'SUCCESS';
                error = null;
            }
        }
        const next = Object.assign({}, snap, { status: status, error: error });
        if (status !== snap.status) {
            try {
                await adminDocRef(db).set({ snapshot: next }, { merge: true });
            } catch (e) { /* best effort */ }
        }
        return next;
    } catch (e) {
        return snap;
    }
}

async function startSnapshotAfterFlip(args) {
    const { db, admin, FieldValue, backupDeps, uid, reason, auditRef, folder, nowMs, events } = args;
    if (events) events.push('export:start');
    const manifest = {
        kind: 'kill-switch-snapshot',
        at: new Date(nowMs).toISOString(),
        flippedBy: uid,
        reason: reason,
        auditId: auditRef.id,
    };
    try {
        const started = await backupDeps.startExport(folder, manifest);
        const snapshot = {
            operationName: started && started.operationName || null,
            outputUri: started && started.outputUriPrefix || ('gs://folder/' + folder),
            startedAt: nowMs,
            status: 'STARTED',
            error: null,
        };
        await adminDocRef(db).set({ snapshot: snapshot }, { merge: true });
        try {
            await auditRef.set({
                snapshotOperationId: snapshot.operationName,
                snapshotOutputUri: snapshot.outputUri,
                snapshotStatus: 'STARTED',
                snapshotReused: false,
            }, { merge: true });
        } catch (e) { /* audit row already written; never delete it */ }
        if (events) events.push('export:ok');
        return snapshot;
    } catch (e) {
        const snapshot = {
            operationName: null,
            outputUri: null,
            startedAt: nowMs,
            status: 'START_FAILED',
            error: String(e && e.message ? e.message : e).slice(0, 300),
        };
        try { await adminDocRef(db).set({ snapshot: snapshot }, { merge: true }); } catch (err) { /* still leave the switch on */ }
        try {
            await auditRef.set({
                snapshotOperationId: null,
                snapshotStatus: 'START_FAILED',
                snapshotError: snapshot.error,
            }, { merge: true });
        } catch (err) { /* never delete the audit row */ }
        if (events) events.push('export:fail');
        console.error('[KILL SWITCH] snapshot failed; switch stays on:', snapshot.error);
        return snapshot;
    }
}


async function notifyAdmins(deps, text, extra) {
    const db = deps.db;
    const FieldValue = deps.admin.firestore.FieldValue;
    const listAdminUids = deps.listAdminUids || (async function () { return []; });
    const sendPhilDm = deps.sendPhilDm || (async function () { return false; });
    let alerted = 0;
    let dmSent = false;
    extra = extra || {};
    try {
        await db.collection('admin_notifications').add({
            type: 'kill_switch',
            action: extra.action || null,
            uid: extra.uid && extra.uid !== 'auto-return' ? maskUid(extra.uid) : (extra.uid || null),
            text: text,
            createdAt: FieldValue.serverTimestamp(),
            read: false,
        });
    } catch (e) { console.warn('[KILL SWITCH] admin_notifications failed'); }
    try {
        const admins = await listAdminUids();
        for (let i = 0; i < admins.length; i++) {
            const dest = admins[i];
            try {
                await db.collection('notifications').add({
                    recipientId: dest,
                    senderName: 'Bitcoin Quest',
                    type: 'security',
                    message: text,
                    read: false,
                    createdAt: FieldValue.serverTimestamp(),
                });
                alerted++;
            } catch (e) { /* one admin must not block the rest */ }
        }
    } catch (e) { console.warn('[KILL SWITCH] listing admins failed'); }
    try { dmSent = !!(await sendPhilDm(text)); } catch (e) { dmSent = false; }
    return { alerted: alerted, dmSent: dmSent };
}

// Idempotent: if the switch is still marked on and autoReenableAt has
// passed, flip it off, write an auto-return audit row, and return fired:true
// so the caller can alert admins and DM Phil. A second call is a no-op.
async function maybeSettleAutoReturn(db, admin, nowFn) {
    const nowMs = nowFn();
    const FieldValue = admin.firestore.FieldValue;
    const ref = docRef(db);
    let fired = false;
    let auditRef = null;
    let reason = '';
    let until = null;
    await db.runTransaction(async function (tx) {
        const snap = await tx.get(ref);
        if (!snap.exists) return;
        const data = snap.data() || {};
        if (data.enabled !== true) return;
        const untilMs = toMillis(data.autoReenableAt);
        if (untilMs == null || nowMs < untilMs) return;
        const adminSnap = await tx.get(adminDocRef(db));
        const adminData = adminSnap.exists ? (adminSnap.data() || {}) : {};
        fired = true;
        reason = adminData.reason || data.reason || '';
        until = untilMs;
        auditRef = db.collection(AUDIT_COLLECTION).doc();
        tx.set(ref, {
            enabled: false,
            mode: 'offline',
            message: null,
            since: null,
            autoReenableAt: null,
            updatedAt: FieldValue.serverTimestamp(),
            reason: FieldValue.delete(),
            updatedBy: FieldValue.delete(),
            snapshot: FieldValue.delete(),
        }, { merge: true });
        tx.set(adminDocRef(db), {
            enabled: false,
            autoReturnedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: 'auto-return',
        }, { merge: true });
        tx.set(auditRef, {
            action: 'auto-return',
            changed: true,
            prevOn: true,
            uid: 'auto-return',
            at: FieldValue.serverTimestamp(),
            reason: reason,
            autoReenableAt: data.autoReenableAt || null,
        });
    });
    return { fired: fired, auditRef: auditRef, reason: reason, until: until };
}

function makeAutoReturnTick(deps) {
    const admin = deps.admin;
    const db = deps.db;
    const nowFn = deps.now || Date.now;
    return async function tick() {
        const result = await maybeSettleAutoReturn(db, admin, nowFn);
        if (!result.fired) return { fired: false };
        const text = autoReturnAlertText(result.reason, result.until);
        const alerted = await notifyAdmins(deps, text, { action: 'auto-return', uid: 'auto-return' });
        if (result.auditRef) {
            try {
                await result.auditRef.set({
                    alertedAdmins: alerted.alerted,
                    alertDmSent: alerted.dmSent,
                }, { merge: true });
            } catch (e) { /* never delete */ }
        }
        console.log('[KILL SWITCH] auto-return fired');
        return { fired: true, alertedAdmins: alerted.alerted, alertSent: alerted.dmSent };
    };
}

function makeAdminSetKillSwitch(deps) {
    const functionsV1 = deps.functionsV1;
    const admin = deps.admin;
    const db = deps.db;
    const HttpsError = functionsV1.https.HttpsError;
    const runWithOpts = deps.runWith || {};
    const sendPhilDm = deps.sendPhilDm || (async function () { return false; });
    const listAdminUids = deps.listAdminUids || (async function () { return []; });
    const backupDeps = deps.backupDeps || makeBackupDeps(admin, db);
    const nowFn = deps.now || Date.now;
    const events = deps.events || null;
    const stepUp = deps.stepUp || (async function (data, context) {
        const sf = require('./secondFactor');
        return sf.requireAdminStepUp(sf.stamp(data, context), 'adminSetKillSwitch');
    });

    async function handler(data, context) {
        const auth = context && context.auth;
        if (!auth || !auth.token || auth.token.admin !== true) {
            throw new HttpsError('permission-denied', 'Admins only.');
        }
        const uid = auth.uid;
        const d = data || {};
        const action = d.action;
        if (action !== 'preflight' && action !== 'status' && action !== 'on' && action !== 'off') {
            throw new HttpsError('invalid-argument', 'action must be preflight, status, on or off');
        }

        // Auto-return first so status/preflight and a later on/off see the settled flag.
        const settled = await maybeSettleAutoReturn(db, admin, nowFn);
        if (settled.fired) {
            const text = autoReturnAlertText(settled.reason, settled.until);
            const alerted = await notifyAdmins({
                db: db, admin: admin, listAdminUids: listAdminUids, sendPhilDm: sendPhilDm,
            }, text, { action: 'auto-return', uid: 'auto-return' });
            if (settled.auditRef) {
                try {
                    await settled.auditRef.set({
                        alertedAdmins: alerted.alerted,
                        alertDmSent: alerted.dmSent,
                    }, { merge: true });
                } catch (e) { /* never delete */ }
            }
        }

        if (action === 'preflight' || action === 'status') {
            const statusRateRef = db.collection(RATE_COLLECTION).doc(uid + '_status');
            const nowMs = nowFn();
            await db.runTransaction(async function (tx) {
                const rateSnap = await tx.get(statusRateRef);
                if (!takeRate(tx, rateSnap, nowMs, RATE_MAX_STATUS_USER)) {
                    throw new HttpsError('resource-exhausted', 'Too many kill-switch status checks. Wait an hour and try again.');
                }
            });
            const snap = await docRef(db).get();
            const cur = snap.exists ? (snap.data() || {}) : null;
            const adminSnap = await adminDocRef(db).get();
            const adminCur = adminSnap.exists ? (adminSnap.data() || {}) : null;
            const snapshot = await maybeRefreshSnapshot(db, admin, backupDeps, adminCur, nowFn);
            const state = publicState(cur, nowFn());
            const out = {
                ok: true,
                state: state,
                admin: adminState(adminCur ? Object.assign({}, adminCur, { snapshot: snapshot || (adminCur && adminCur.snapshot) }) : null, nowFn()),
                autoReturned: !!settled.fired,
            };
            if (action === 'preflight') {
                out.preflight = await backupPreflight(Object.assign({ now: nowFn }, backupDeps));
            }
            return out;
        }

        await stepUp(d, context);

        const reason = cleanReason(d.reason);
        if (reason.length < MIN_REASON) {
            throw new HttpsError('invalid-argument', 'Add a short reason (at least ' + MIN_REASON + ' characters).');
        }
        const expected = action === 'on' ? CONFIRM_ON : CONFIRM_OFF;
        if (d.confirm !== expected) {
            throw new HttpsError('failed-precondition', 'Type ' + expected + ' to confirm.');
        }

        let autoMs = null;
        let preflight = null;
        const override = d.override === true;
        if (action === 'on') {
            const mins = parseReenable(d.reenableInMinutes);
            if (Number.isNaN(mins)) throw new HttpsError('invalid-argument', 'Auto-return must be 5 minutes to 7 days.');
            autoMs = mins ? nowFn() + mins * 60000 : null;
            preflight = await backupPreflight(Object.assign({ now: nowFn }, backupDeps));
            if (!preflight.ok && !override) {
                return { ok: false, needsOverride: true, preflight: preflight };
            }
        }

        const FieldValue = admin.firestore.FieldValue;
        const Timestamp = admin.firestore.Timestamp;
        const ref = docRef(db);
        const adminRef = adminDocRef(db);
        const auditRef = db.collection(AUDIT_COLLECTION).doc();
        const userRateRef = db.collection(RATE_COLLECTION).doc(uid);
        const globalRateRef = db.collection(RATE_COLLECTION).doc('_global');
        let prevOn = false;
        let prevReason = '';
        let prevAutoMs = null;
        let prevAdmin = null;
        let noop = false;
        const nowMs = nowFn();

        await db.runTransaction(async function (tx) {
            const snap = await tx.get(ref);
            const adminSnap = await tx.get(adminRef);
            const prev = snap.exists ? (snap.data() || {}) : null;
            prevAdmin = adminSnap.exists ? (adminSnap.data() || {}) : null;
            prevOn = effectiveOn(prev, nowMs);
            prevReason = (prevAdmin && prevAdmin.reason) || (prev && prev.reason) || '';
            prevAutoMs = toMillis(prev && prev.autoReenableAt);

            if (action === 'off' && !prevOn) {
                noop = true;
                return;
            }
            if (action === 'on' && prevOn) {
                if (!isLaterAutoReturn(prevAutoMs, autoMs)) {
                    throw new HttpsError(
                        'failed-precondition',
                        'The app is already offline. You can only extend the auto-return to a later time (or leave it off until an admin turns it back on).'
                    );
                }
            }

            // Rate budget applies only to writes that change state.
            const userRateSnap = await tx.get(userRateRef);
            const globalRateSnap = await tx.get(globalRateRef);
            if (!takeRate(tx, userRateSnap, nowMs, RATE_MAX_USER) || !takeRate(tx, globalRateSnap, nowMs, RATE_MAX_GLOBAL)) {
                throw new HttpsError('resource-exhausted', 'Too many kill-switch changes. Wait an hour and try again.');
            }

            const publicNext = {
                enabled: action === 'on',
                mode: 'offline',
                message: action === 'on' ? OFFLINE_MESSAGE : null,
                autoReenableAt: autoMs ? Timestamp.fromMillis(autoMs) : null,
                updatedAt: FieldValue.serverTimestamp(),
                reason: FieldValue.delete(),
                updatedBy: FieldValue.delete(),
                snapshot: FieldValue.delete(),
            };
            if (action === 'on') publicNext.since = (prevOn && prev && prev.since) ? prev.since : FieldValue.serverTimestamp();
            else publicNext.since = null;
            tx.set(ref, publicNext, { merge: true });
            tx.set(adminRef, {
                enabled: action === 'on',
                reason: reason,
                autoReenableAt: autoMs ? Timestamp.fromMillis(autoMs) : null,
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: uid,
            }, { merge: true });
            tx.set(auditRef, {
                action: action,
                changed: prevOn !== (action === 'on'),
                prevOn: prevOn,
                uid: uid,
                signInProvider: (auth.token.firebase && auth.token.firebase.sign_in_provider) || null,
                at: FieldValue.serverTimestamp(),
                reason: reason,
                reasonChanged: reason !== prevReason,
                autoReenableAt: autoMs ? Timestamp.fromMillis(autoMs) : null,
                autoReenableChanged: (prevAutoMs || null) !== (autoMs || null),
                backupCheckOk: preflight ? preflight.ok : null,
                backupOverride: action === 'on' ? (preflight ? !preflight.ok && override : false) : false,
                backupChecks: preflight ? preflight.checks.map(function (c) { return { id: c.id, ok: c.ok, skipped: !!c.skipped }; }) : null,
                snapshotOperationId: null,
                snapshotStatus: null,
            });
        });
        if (noop) {
            return { ok: true, on: false, changed: false, noop: true, autoReenableAt: null, alertedAdmins: 0, alertSent: false };
        }
        if (events) events.push('flip');

        const changed = prevOn !== (action === 'on');
        const reasonChanged = reason !== prevReason;
        const autoChanged = (prevAutoMs || null) !== (autoMs || null);
        let snapshot = null;
        // Flip first, then snapshot. A failed export must leave the switch as written.
        // Reuse a snapshot started in the last 6 hours instead of starting another full export.
        // Extending auto-return while already on does not start a new snapshot.
        if (action === 'on' && changed) {
            const reused = reuseRecentSnapshot(prevAdmin, nowMs);
            if (reused) {
                snapshot = Object.assign({}, reused, { reused: true });
                try { await adminDocRef(db).set({ snapshot: snapshot }, { merge: true }); } catch (e) { /* keep the flag on */ }
                try {
                    await auditRef.set({
                        snapshotOperationId: snapshot.operationName,
                        snapshotOutputUri: snapshot.outputUri || null,
                        snapshotStatus: snapshot.status || 'REUSED',
                        snapshotReused: true,
                    }, { merge: true });
                } catch (e) { /* never delete */ }
                if (events) events.push('export:reuse');
            } else {
                const folder = 'kill-switch/' + snapshotFolderStamp(nowMs);
                snapshot = await startSnapshotAfterFlip({
                    db: db, admin: admin, FieldValue: FieldValue, backupDeps: backupDeps,
                    uid: uid, reason: reason, auditRef: auditRef, folder: folder, nowMs: nowMs, events: events,
                });
            }
        }

        let alerted = 0;
        let dmSent = false;
        // Alert on every state write: a flip, a reason change, or an auto-return change.
        const shouldAlert = changed || reasonChanged || autoChanged;
        if (shouldAlert) {
            const text = changed
                ? alertText(action, uid, reason, autoMs, preflight ? (!preflight.ok && override) : false, preflight)
                : extendAlertText(uid, reason, autoMs, prevAutoMs);
            const noted = await notifyAdmins({
                db: db, admin: admin, listAdminUids: listAdminUids, sendPhilDm: sendPhilDm,
            }, text, { action: action, uid: uid });
            alerted = noted.alerted;
            dmSent = noted.dmSent;
            try { await auditRef.set({ alertedAdmins: alerted, alertDmSent: dmSent }, { merge: true }); } catch (e) { /* never delete */ }
        }
        console.log('[KILL SWITCH] ' + action + ' by ' + maskUid(uid) + (changed ? '' : ' (no flip)'));
        return {
            ok: true,
            on: action === 'on',
            changed: changed,
            autoReenableAt: autoMs,
            alertedAdmins: alerted,
            alertSent: dmSent,
            preflight: preflight,
            snapshot: snapshot,
        };
    }

    const fn = functionsV1.runWith(runWithOpts).https.onCall(handler);
    fn.__handler = handler;
    return fn;
}

module.exports = {
    KILL_SWITCH_COLLECTION, KILL_SWITCH_DOC_ID, KILL_SWITCH_ADMIN_DOC_ID, AUDIT_COLLECTION, RATE_COLLECTION,
    OFFLINE_MESSAGE, CONFIRM_ON, CONFIRM_OFF, CONFIRM_WORD: CONFIRM_ON,
    BACKUP_BUCKET_DEFAULT, BACKUP_MAX_AGE_HOURS, MAX_REENABLE_MIN, MIN_REENABLE_MIN,
    MIN_REASON, RATE_WINDOW_MS, RATE_MAX_USER, RATE_MAX_GLOBAL, RATE_MAX_STATUS_USER, SNAPSHOT_REUSE_MS,
    GATED, gatedNames, gatedTriggerNames, effectiveOn, isLaterAutoReturn, isOffline, reuseRecentSnapshot,
    makeReader, gateExport, gateExports, backupPreflight,
    makeBackupDeps, makeAdminSetKillSwitch, makeAutoReturnTick, maybeSettleAutoReturn,
    cleanReason, parseReenable, maskUid, alertText, extendAlertText, autoReturnAlertText,
    publicState, adminState, snapshotFolderStamp, notifyAdmins,
};
