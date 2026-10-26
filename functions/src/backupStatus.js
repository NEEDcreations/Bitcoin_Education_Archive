'use strict';

// Firestore status for nightly backups. No email, no chat.
// backup_status/latest is overwritten. backup_history/{runId} is appended
// with expireAt 90 days out. Clients cannot read either collection.

const health = require('./backupHealth');

const JOB_NAMES = ['firestore', 'auth', 'uploads', 'config'];
const HISTORY_TTL_DAYS = 90;
const STALE_MS = 26 * 60 * 60 * 1000;
const LATEST_COLLECTION = 'backup_status';
const LATEST_DOC = 'latest';
const HISTORY_COLLECTION = 'backup_history';

function makeRunId(job, finishedAt) {
    const stamp = String(finishedAt || new Date().toISOString())
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, 'Z');
    return job + '-' + stamp;
}

function expireDate(finishedAt) {
    const d = new Date(finishedAt || Date.now());
    if (Number.isNaN(d.getTime())) throw new Error('bad finishedAt');
    d.setUTCDate(d.getUTCDate() + HISTORY_TTL_DAYS);
    return d;
}

function jobDetail(event) {
    const fallback = event && event.ok === true ? 'ok' : 'failed';
    return health.sanitizeAlertDetail(event && event.detail ? event.detail : fallback);
}

function verifiedAfterCutoff(date, verifiedAt) {
    if (!date || !verifiedAt) return false;
    const verified = Date.parse(verifiedAt);
    const cutoff = Date.parse(date + 'T05:00:00.000Z');
    if (Number.isNaN(verified) || Number.isNaN(cutoff)) return false;
    return verified >= cutoff;
}

function statusDetail(date, failed, verifiedAt, nowIso) {
    if (failed.length) return 'failed: ' + failed.join(', ');
    const now = new Date(nowIso || Date.now());
    if (Number.isNaN(now.getTime()) || health.utcDateString(now) !== date) {
        return 'status is not for today';
    }
    if (!verifiedAfterCutoff(date, verifiedAt)) return 'not verified after 05:00 UTC';
    return 'all checks passed';
}

function finiteCount(value, fallback) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
    const prior = Number(fallback);
    return Number.isFinite(prior) ? prior : 0;
}

function r2IsStale(job, nowIso) {
    if (!job || !job.finishedAt) return true;
    const finished = Date.parse(job.finishedAt);
    const now = Date.parse(nowIso || new Date().toISOString());
    if (Number.isNaN(finished) || Number.isNaN(now)) return true;
    return now - finished > STALE_MS;
}

function checkerVerdict(latest, nowIso) {
    const now = Date.parse(nowIso || new Date().toISOString());
    const updated = latest && latest.updatedAt ? Date.parse(latest.updatedAt) : NaN;
    if (!latest || !latest.updatedAt || Number.isNaN(updated) || Number.isNaN(now) || now - updated > STALE_MS) {
        return { ok: false, detail: 'status is older than 26 hours' };
    }
    return { ok: latest.ok === true, detail: latest.detail || '' };
}

function nextLatest(previous, event, nowIso, options) {
    // The four nightly jobs are always required. r2 is required when the
    // health check passes r2Required. A missing r2 record, r2.ok !== true,
    // or an r2 finishedAt older than 26 hours then fails the day. A job
    // write that does not ask for that check still fails when a present r2
    // record is not ok, and does not fail merely because r2 is absent.
    const r2Required = !!(options && options.r2Required);
    const isR2 = event.job === 'r2';
    if (!isR2 && JOB_NAMES.indexOf(event.job) === -1) throw new Error('unknown backup job');
    const date = event.date;
    const sameDay = !!(previous && previous.date === date && previous.jobs);
    const jobs = {};
    for (let i = 0; i < JOB_NAMES.length; i++) {
        const name = JOB_NAMES[i];
        if (sameDay && previous.jobs[name]) jobs[name] = previous.jobs[name];
    }
    if (sameDay && previous.jobs.r2 && !isR2) jobs.r2 = previous.jobs.r2;
    if (isR2) {
        const prior = (sameDay && previous.jobs.r2) || {};
        jobs.r2 = {
            ok: event.ok === true,
            startedAt: event.startedAt || prior.startedAt || null,
            finishedAt: event.finishedAt || null,
            detail: jobDetail(event),
            objectCount: finiteCount(event.objectCount, prior.objectCount),
            bytes: finiteCount(event.bytes, prior.bytes),
        };
    } else {
        const prior = jobs[event.job] || {};
        jobs[event.job] = {
            ok: event.ok === true,
            startedAt: event.startedAt || prior.startedAt || null,
            finishedAt: event.finishedAt || null,
            detail: jobDetail(event),
        };
    }
    const failed = [];
    for (let i = 0; i < JOB_NAMES.length; i++) {
        const name = JOB_NAMES[i];
        if (!jobs[name] || jobs[name].ok !== true) failed.push(name);
    }
    if (r2Required) {
        if (!jobs.r2 || jobs.r2.ok !== true || r2IsStale(jobs.r2, nowIso)) failed.push('r2');
    } else if (jobs.r2 && jobs.r2.ok !== true) {
        failed.push('r2');
    }
    // A nightly job write clears verification. The r2 copy keeps a same-day
    // verifiedAt so a later ciphertext copy does not hide a 05:00 check.
    // Only an event that carries verifiedAt (the 05:00 health check) can
    // set it. The health rewrite keeps jobs.r2, including a failure.
    const verifiedAt = isR2
        ? (event.verifiedAt || (sameDay ? (previous.verifiedAt || null) : null))
        : (event.verifiedAt || null);
    const detail = statusDetail(date, failed, verifiedAt, nowIso);
    return {
        ok: detail === 'all checks passed',
        date: date,
        updatedAt: event.finishedAt || new Date().toISOString(),
        verifiedAt: verifiedAt,
        detail: detail,
        jobs: jobs,
    };
}

function historyDoc(event, expireAt) {
    const doc = {
        runId: event.runId,
        job: event.job,
        date: event.date,
        ok: event.ok === true,
        startedAt: event.startedAt || null,
        finishedAt: event.finishedAt || null,
        detail: jobDetail(event),
        expireAt: expireAt,
    };
    if (event.job === 'r2') {
        doc.objectCount = finiteCount(event.objectCount, 0);
        doc.bytes = finiteCount(event.bytes, 0);
    }
    return doc;
}

async function writeBackupResults(db, admin, events, nowIso, options) {
    const list = events || [];
    if (!list.length) return [];
    const now = nowIso || new Date().toISOString();
    const latestRef = db.collection(LATEST_COLLECTION).doc(LATEST_DOC);
    const runIds = [];
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(latestRef);
        let prev = snap.exists ? snap.data() : null;
        for (let i = 0; i < list.length; i++) {
            const finishedAt = list[i].finishedAt || now;
            const runId = list[i].runId || makeRunId(list[i].job, finishedAt);
            const full = Object.assign({}, list[i], { finishedAt: finishedAt, runId: runId });
            prev = nextLatest(prev, full, now, options);
            const expireAt = admin.firestore.Timestamp.fromDate(expireDate(finishedAt));
            tx.set(db.collection(HISTORY_COLLECTION).doc(runId), historyDoc(full, expireAt));
            runIds.push(runId);
        }
        tx.set(latestRef, prev);
    });
    return runIds;
}

async function writeBackupResult(db, admin, event) {
    const ids = await writeBackupResults(db, admin, [event]);
    return ids[0];
}

module.exports = {
    JOB_NAMES,
    HISTORY_TTL_DAYS,
    STALE_MS,
    LATEST_COLLECTION,
    LATEST_DOC,
    HISTORY_COLLECTION,
    makeRunId,
    expireDate,
    verifiedAfterCutoff,
    checkerVerdict,
    r2IsStale,
    nextLatest,
    historyDoc,
    writeBackupResult,
    writeBackupResults,
};
