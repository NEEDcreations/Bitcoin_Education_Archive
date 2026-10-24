'use strict';

// Pure backup health-check and alert dedupe. No Firebase, no network, no mail.
// Alerts are email only. Do not add a chat, webhook, or bot sender here.

const ALERT_EMAIL = 'info.603btc@gmail.com';
const USER_COUNT_TOLERANCE = 0.10;
const ALERT_LEASE_MS = 15 * 60 * 1000;

const CONFIG_OBJECT_NAMES = [
    'firestore-rules.json',
    'storage-rules.json',
    'firestore-indexes.json',
    'firestore-ttl.json',
    'scheduler-jobs.json',
];

function utcDateString(date) {
    return date.toISOString().slice(0, 10);
}

function addUtcDays(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00.000Z');
    if (Number.isNaN(d.getTime())) throw new Error('bad date');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

function sanitizeAlertDetail(detail) {
    let s = String(detail == null ? '' : detail).replace(/[\r\n]+/g, ' ').slice(0, 500);
    s = s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]');
    s = s.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[redacted-ip]');
    s = s.replace(/\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f:]{0,40}\b/gi, '[redacted-ip]');
    s = s.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]');
    s = s.replace(/-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, '[redacted-key]');
    return s;
}

function compareUserCount(today, previous) {
    if (typeof today !== 'number' || !Number.isFinite(today)) {
        return { ok: false, detail: 'auth export user count is missing' };
    }
    if (today <= 0) {
        return { ok: false, detail: 'auth export user count is zero' };
    }
    if (previous == null || typeof previous !== 'number' || !Number.isFinite(previous) || previous <= 0) {
        return { ok: true, detail: 'auth export user count ' + today + ' (no previous baseline)' };
    }
    const delta = Math.abs(today - previous) / previous;
    const pct = Math.round(delta * 1000) / 10;
    if (delta <= USER_COUNT_TOLERANCE + 1e-9) {
        return { ok: true, detail: 'auth export user count ' + today + ' vs previous ' + previous };
    }
    return {
        ok: false,
        detail: 'auth export user count ' + today + ' vs previous ' + previous + ' (' + pct + '% change)',
    };
}

function assessFirestore(input) {
    const src = input || {};
    const folderPresent = src.objectCount > 0;
    if (src.markerError) {
        return { succeeded: false, folderPresent, detail: 'Firestore export request failed' };
    }
    if (src.operationError) {
        return { succeeded: false, folderPresent, detail: 'Firestore export operation failed' };
    }
    if (src.operationDone === true && folderPresent) {
        return { succeeded: true, folderPresent: true, detail: 'Firestore export finished and the folder is present' };
    }
    if (src.operationDone === true && !folderPresent) {
        return { succeeded: false, folderPresent: false, detail: 'Firestore export finished but the folder is empty' };
    }
    if (src.operationDone === false) {
        return { succeeded: false, folderPresent, detail: 'Firestore export was still running at the health check' };
    }
    if (src.sawMetadata && folderPresent) {
        return { succeeded: true, folderPresent: true, detail: 'Firestore export metadata file is present' };
    }
    if (folderPresent) {
        return { succeeded: false, folderPresent: true, detail: 'Firestore export folder exists but success was not confirmed' };
    }
    return { succeeded: false, folderPresent: false, detail: 'Firestore export folder is missing' };
}

function assessAuth(input) {
    const src = input || {};
    if (!src.present || !(src.bytes > 0)) {
        return { present: false, countOk: false, detail: 'auth export object is missing' };
    }
    const cmp = compareUserCount(src.userCount, src.previousCount);
    return { present: true, countOk: cmp.ok, detail: cmp.detail };
}

function assessUploads(input) {
    const src = input || {};
    const status = src.operationStatus || '';
    if (src.operationError || status === 'FAILED' || status === 'ABORTED') {
        return { ran: false, detail: 'uploads copy failed' };
    }
    if (src.started && (status === 'SUCCESS' || status === 'IN_PROGRESS' || status === 'QUEUED')) {
        return { ran: true, detail: 'uploads copy ' + status.toLowerCase() };
    }
    if (src.fallbackComplete === true) {
        return { ran: true, detail: 'uploads incremental copy finished' };
    }
    if (src.started && !status && !src.operationError) {
        return { ran: true, detail: 'uploads copy started' };
    }
    return { ran: false, detail: src.detail || 'uploads copy did not run' };
}

function missingConfigFiles(foundNames) {
    const have = new Set(foundNames || []);
    return CONFIG_OBJECT_NAMES.filter((name) => !have.has(name));
}

function assessConfig(foundNames) {
    const missing = missingConfigFiles(foundNames);
    if (missing.length) {
        return { present: false, detail: 'config snapshot missing ' + missing.join(', ') };
    }
    return { present: true, detail: 'config snapshot present' };
}

function evaluateBackupHealth(report) {
    const src = report || {};
    const failures = [];
    const firestore = src.firestore || {};
    if (firestore.succeeded !== true || firestore.folderPresent !== true) {
        failures.push({
            check: 'firestore',
            detail: firestore.detail || 'Firestore export did not succeed',
        });
    }
    const auth = src.auth || {};
    if (auth.present !== true || auth.countOk !== true) {
        failures.push({
            check: 'auth',
            detail: auth.detail || 'Auth export failed the health check',
        });
    }
    const uploads = src.uploads || {};
    if (uploads.ran !== true) {
        failures.push({
            check: 'uploads',
            detail: uploads.detail || 'Uploads copy did not run',
        });
    }
    const config = src.config || {};
    if (config.present !== true) {
        failures.push({
            check: 'config',
            detail: config.detail || 'Config snapshot is missing',
        });
    }
    return { ok: failures.length === 0, failures };
}

function decideAlert(failures, dedupe, nowMs) {
    if (!failures || failures.length === 0) return { send: false, reason: 'healthy' };
    if (dedupe && dedupe.sent === true) return { send: false, reason: 'already-sent' };
    const now = typeof nowMs === 'number' ? nowMs : 0;
    if (dedupe && typeof dedupe.leaseUntil === 'number' && dedupe.leaseUntil > now) {
        return { send: false, reason: 'lease-held' };
    }
    return { send: true, reason: 'failure' };
}

// Same transitions the Firestore transaction applies to backup_alerts/{date}.
function reduceDedupe(state, action, nowMs) {
    const current = state || null;
    if (!action || action.type === 'reserve') {
        const decision = decideAlert(action && action.failures, current, nowMs);
        if (!decision.send) return { state: current, decision };
        return {
            state: { sent: false, leaseUntil: nowMs + ALERT_LEASE_MS },
            decision: { send: true, reason: 'reserved' },
        };
    }
    if (action.type === 'sent') {
        return {
            state: { sent: true, leaseUntil: nowMs },
            decision: { send: false, reason: 'marked-sent' },
        };
    }
    if (action.type === 'release') {
        return {
            state: { sent: false, leaseUntil: 0 },
            decision: { send: false, reason: 'released' },
        };
    }
    throw new Error('unknown dedupe action');
}

function sanitizeSchedulerJob(job) {
    const copy = JSON.parse(JSON.stringify(job || {}));
    const http = copy.httpTarget;
    if (http) {
        if (http.headers) {
            Object.keys(http.headers).forEach((header) => {
                if (/authorization|cookie|api-key|secret|token|password/i.test(header)) {
                    delete http.headers[header];
                }
            });
        }
        if (typeof http.uri === 'string') http.uri = http.uri.split('?')[0];
        if (http.oidcToken) delete http.oidcToken.token;
        if (http.oauthToken) {
            http.oauthToken = { serviceAccountEmail: http.oauthToken.serviceAccountEmail || null };
        }
    }
    return copy;
}

function buildAlertBody(input) {
    const src = input || {};
    const lines = [
        'Bitcoin Quest nightly backup health check failed.',
        'Backup date: ' + (src.date || ''),
        'Checked at: ' + (src.checkedAt || ''),
        '',
        'Failed checks:',
    ];
    const failures = src.failures || [];
    for (let i = 0; i < failures.length; i++) {
        const failure = failures[i] || {};
        lines.push('- ' + String(failure.check || 'unknown') + ': ' + sanitizeAlertDetail(failure.detail || ''));
    }
    lines.push('');
    lines.push('This alert does not include account data.');
    return lines.join('\n');
}

module.exports = {
    ALERT_EMAIL,
    USER_COUNT_TOLERANCE,
    ALERT_LEASE_MS,
    CONFIG_OBJECT_NAMES,
    utcDateString,
    addUtcDays,
    sanitizeAlertDetail,
    compareUserCount,
    assessFirestore,
    assessAuth,
    assessUploads,
    missingConfigFiles,
    assessConfig,
    evaluateBackupHealth,
    decideAlert,
    reduceDedupe,
    sanitizeSchedulerJob,
    buildAlertBody,
};
