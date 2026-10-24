'use strict';

// Firestore status for nightly backups. No email, no chat.
// backup_status/latest is overwritten. backup_history/{runId} is appended
// with expireAt 90 days out. Clients cannot read either collection.

const health = require('./backupHealth');

const JOB_NAMES = ['firestore', 'auth', 'uploads', 'config'];
const HISTORY_TTL_DAYS = 90;
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

function nextLatest(previous, event, nowIso) {
    if (JOB_NAMES.indexOf(event.job) === -1) throw new Error('unknown backup job');
    const date = event.date;
    const sameDay = !!(previous && previous.date === date && previous.jobs);
    const jobs = {};
    for (let i = 0; i < JOB_NAMES.length; i++) {
        const name = JOB_NAMES[i];
        if (sameDay && previous.jobs[name]) jobs[name] = previous.jobs[name];
    }
    const prior = jobs[event.job] || {};
    jobs[event.job] = {
        ok: event.ok === true,
        startedAt: event.startedAt || prior.startedAt || null,
        finishedAt: event.finishedAt || null,
        detail: jobDetail(event),
    };
    const failed = [];
    for (let i = 0; i < JOB_NAMES.length; i++) {
        const name = JOB_NAMES[i];
        if (!jobs[name] || jobs[name].ok !== true) failed.push(name);
    }
    // A job write clears verification. Only an event that carries verifiedAt
    // (the 05:00 health check) can make the overall status ok.
    const verifiedAt = event.verifiedAt || null;
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
    return {
        runId: event.runId,
        job: event.job,
        date: event.date,
        ok: event.ok === true,
        startedAt: event.startedAt || null,
        finishedAt: event.finishedAt || null,
        detail: jobDetail(event),
        expireAt: expireAt,
    };
}

async function writeBackupResults(db, admin, events, nowIso) {
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
            prev = nextLatest(prev, full, now);
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
    LATEST_COLLECTION,
    LATEST_DOC,
    HISTORY_COLLECTION,
    makeRunId,
    expireDate,
    verifiedAfterCutoff,
    nextLatest,
    historyDoc,
    writeBackupResult,
    writeBackupResults,
};
