'use strict';

// Pure backup health checks. No Firebase, no network, no mail, no chat alerts.
// Status documents are written by backupStatus.js. An external checker reads
// them with admin credentials. Do not send these results by email or chat.

const USER_COUNT_TOLERANCE = 0.10;

const CONFIG_OBJECT_NAMES = [
    'firestore-rules.json',
    'storage-rules.json',
    'firestore-indexes.json',
    'firestore-ttl.json',
    'scheduler-jobs.json',
    'cloud-functions.json',
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
    let s = String(detail == null ? '' : detail).replace(/[\r\n]+/g, ' ');
    s = s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]');
    s = s.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[redacted-ip]');
    s = s.replace(/\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f:]{0,40}\b/gi, '[redacted-ip]');
    s = s.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]');
    s = s.replace(/-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, '[redacted-key]');
    s = s.replace(/\b[A-Za-z0-9]{20,}\b/g, '[redacted-id]');
    s = s.replace(/\s+/g, ' ').trim();
    if (s.length > 160) s = s.slice(0, 157) + '...';
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

function sanitizeCloudFunction(fn) {
    const src = fn || {};
    const build = src.buildConfig || {};
    const svc = src.serviceConfig || {};
    const env = svc.environmentVariables || src.environmentVariables || {};
    const secrets = svc.secretEnvironmentVariables || src.secretEnvironmentVariables || [];
    const secretNames = [];
    for (let i = 0; i < secrets.length; i++) {
        const item = secrets[i] || {};
        if (item.secret) secretNames.push(String(item.secret));
        else if (item.key) secretNames.push(String(item.key));
    }
    return {
        name: src.name || null,
        state: src.state || src.status || null,
        updateTime: src.updateTime || null,
        runtime: build.runtime || src.runtime || null,
        entryPoint: build.entryPoint || src.entryPoint || null,
        availableMemory: svc.availableMemory || src.availableMemoryMb || null,
        timeoutSeconds: svc.timeoutSeconds || src.timeout || null,
        maxInstanceCount: svc.maxInstanceCount || null,
        serviceAccountEmail: svc.serviceAccountEmail || null,
        envKeys: Object.keys(env).sort(),
        secretNames: secretNames.sort(),
    };
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

module.exports = {
    USER_COUNT_TOLERANCE,
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
    sanitizeCloudFunction,
    sanitizeSchedulerJob,
};
