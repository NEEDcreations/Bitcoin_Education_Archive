'use strict';

// All-time Satoshi's Favor points a user has contributed. Contributor docs
// live under satoshiFavor/current and are not wiped when a favor window ends,
// so the total is all-time, not the current 21-point window.
// The counter at satoshiFavor/userSfPoints/users/{uid} is server-written.
// Clients may read only their own doc.

const POINT_VALUES = {
    daily_all_three: 1,
    level_up: 1,
    level_up_5: 5,
    level_up_10: 10,
    badge_earned: 1,
};

function contributionPoints(row) {
    const src = row || {};
    const raw = src.pointsAdded;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
    const mapped = POINT_VALUES[src.source];
    if (mapped) return mapped;
    return 1;
}

// rows: [{ uid, pointsAdded, source }]
// Skips rows with no uid. Returns absolute totals, safe to write over a counter.
function tallyUserSfPoints(rows) {
    const byUid = {};
    let docs = 0;
    let points = 0;
    (rows || []).forEach(function (row) {
        const uid = row && row.uid ? String(row.uid) : '';
        if (!uid) return;
        const n = contributionPoints(row);
        byUid[uid] = (byUid[uid] || 0) + n;
        docs += 1;
        points += n;
    });
    return {
        byUid: byUid,
        users: Object.keys(byUid).length,
        docs: docs,
        points: points,
    };
}

module.exports = {
    POINT_VALUES: POINT_VALUES,
    contributionPoints: contributionPoints,
    tallyUserSfPoints: tallyUserSfPoints,
};
