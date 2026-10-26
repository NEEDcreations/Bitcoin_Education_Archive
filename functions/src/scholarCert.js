'use strict';

const crypto = require('crypto');

const VERIFY_ORIGIN = 'https://bitcoineducation.quest/';

const EXAM_CERT = {
    properties: {
        certType: 'scholar',
        title: 'Bitcoin Scholar',
        quest: 'bitcoin-scholar',
    },
    technical: {
        certType: 'technical',
        title: 'Bitcoin Protocol Expert',
        quest: 'protocol-expert',
    },
};

function certTypeForExam(examType) {
    const meta = EXAM_CERT[examType];
    return meta ? meta.certType : '';
}

function metaForCertType(certType) {
    if (certType === 'scholar') return EXAM_CERT.properties;
    if (certType === 'technical') return EXAM_CERT.technical;
    if (certType === 'trail_meadow' || certType === 'trail_mountain' || certType === 'trail_summit') {
        return { certType: certType, title: 'Nacho Trail Complete', quest: certType };
    }
    return null;
}

function snapshotName(userData) {
    const raw = userData && (userData.username || userData.displayName) || 'Bitcoiner';
    const name = String(raw).trim().substring(0, 50);
    return name || 'Bitcoiner';
}

function clientName(value) {
    const name = String(value || '').trim().substring(0, 50);
    return name || 'Bitcoiner';
}

function newCertId(now) {
    const stamp = Number(now || Date.now()).toString(36).toUpperCase();
    return 'CERT-' + stamp + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

function longDate(now) {
    return new Date(now || Date.now()).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

function verifyPath(certId) {
    return '#cert/' + certId;
}

function verifyUrl(certId) {
    return VERIFY_ORIGIN + '#cert/' + certId;
}

function indexId(uid, certType) {
    return String(uid) + '_' + String(certType);
}

// Same ban check gradeScholarExam already uses for the cert bonus.
function rewardBlocked(userData, ledger) {
    const user = userData || {};
    const row = ledger || {};
    return !!(user.ban_reason) || user.banned === true || user.satsDisabled === true || row.banned === true;
}

function buildRecord(opts) {
    const src = opts || {};
    const meta = src.meta || metaForCertType(src.certType) || EXAM_CERT[src.examType];
    if (!meta) throw new Error('certificate type');
    const id = src.certId || newCertId(src.now);
    const name = src.name || snapshotName(src.userData);
    const date = src.date || longDate(src.now);
    const score = src.score == null ? null : src.score;
    const publicDoc = {
        id: id,
        name: name,
        type: meta.certType,
        title: meta.title,
        quest: meta.quest,
        score: score,
        date: date,
        verifyPath: verifyPath(id),
    };
    return {
        id: id,
        name: name,
        title: meta.title,
        quest: meta.quest,
        date: date,
        score: score,
        certType: meta.certType,
        publicDoc: publicDoc,
        ownerDoc: { uid: src.uid, type: meta.certType, certId: id },
        indexDoc: { certId: id, uid: src.uid, type: meta.certType },
    };
}

function publicView(data, certId) {
    const row = data || {};
    return {
        certId: certId || row.id,
        title: row.title || '',
        name: row.name || '',
        date: row.date || '',
        score: row.score == null ? null : row.score,
        quest: row.quest || '',
        type: row.type || '',
        verifyUrl: verifyUrl(certId || row.id),
    };
}

module.exports = {
    EXAM_CERT: EXAM_CERT,
    certTypeForExam: certTypeForExam,
    metaForCertType: metaForCertType,
    snapshotName: snapshotName,
    clientName: clientName,
    newCertId: newCertId,
    longDate: longDate,
    verifyPath: verifyPath,
    verifyUrl: verifyUrl,
    indexId: indexId,
    rewardBlocked: rewardBlocked,
    buildRecord: buildRecord,
    publicView: publicView,
};
