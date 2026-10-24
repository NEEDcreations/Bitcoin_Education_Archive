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

function nextLatest(previous, event) {
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
    return {
        ok: failed.length === 0,
        date: date,
        updatedAt: event.finishedAt || new Date().toISOString(),
        detail: failed.length === 0 ? 'all checks passed' : ('failed: ' + failed.join(', ')),
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

async function writeBackupResults(db, admin, events) {
    const list = events || [];
    if (!list.length) return [];
    const latestRef = db.collection(LATEST_COLLECTION).doc(LATEST_DOC);
    const runIds = [];
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(latestRef);
        let prev = snap.exists ? snap.data() : null;
        for (let i = 0; i < list.length; i++) {
            const finishedAt = list[i].finishedAt || new Date().toISOString();
            const runId = list[i].runId || makeRunId(list[i].job, finishedAt);
            const full = Object.assign({}, list[i], { finishedAt: finishedAt, runId: runId });
            prev = nextLatest(prev, full);
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
    nextLatest,
    historyDoc,
    writeBackupResult,
    writeBackupResults,
};
