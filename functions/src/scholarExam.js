'use strict';

// A passing scholar_exam_keys row is the proof. Profile flags are not.
// The query is uid-only so it uses the automatic single-field index, and so
// grading can mark the current exam passed without changing the query set.

function examsForUser(db, uid) {
    return db.collection('scholar_exam_keys').where('uid', '==', uid);
}

function eachExam(snap, visit) {
    if (!snap || typeof snap.forEach !== 'function') return;
    snap.forEach(function (doc) {
        const row = doc && typeof doc.data === 'function' ? (doc.data() || {}) : {};
        visit(doc, row);
    });
}

function passedExam(snap, examType, exceptId) {
    let found = null;
    eachExam(snap, function (doc, row) {
        if (found) return;
        if (exceptId && doc.id === exceptId) return;
        if (row.type === examType && row.passed === true) found = row;
    });
    return found;
}

module.exports = {
    examsForUser: examsForUser,
    passedExam: passedExam,
};
