'use strict';

// Proof of Walk distance math. 50 XP per km, 42 km per activity date.
// The caller sums rawPoints and runs that once through the shared daily cap
// for today. This file does not write points or pendingOverflow.

const WALK_TYPES = ['Walk', 'Run', 'Hike'];
const KM_CAP = 42;
const XP_PER_KM = 50;

function walkDate(act) {
    const raw = act && (act.start_date_local || act.start_date) ? (act.start_date_local || act.start_date) : '';
    return String(raw).split('T')[0];
}

function planWalkSync(input) {
    const src = input || {};
    const activities = Array.isArray(src.activities) ? src.activities : [];
    const already = src.already || {};
    let dailyData = Object.assign({ date: '', distance: 0 }, src.dailyData || {});
    dailyData.distance = Number(dailyData.distance) || 0;
    const rows = [];
    let rawPoints = 0;
    activities.forEach(function (act) {
        if (!act || WALK_TYPES.indexOf(act.type) === -1) return;
        const id = String(act.id);
        if (!id || already[id]) return;
        const dateStr = walkDate(act);
        const actKm = Number(act.distance) / 1000;
        if (!dateStr || !Number.isFinite(actKm) || actKm < 0) return;
        if (dailyData.date !== dateStr) dailyData = { date: dateStr, distance: 0 };
        const remainingCap = Math.max(0, KM_CAP - dailyData.distance);
        const allocatableKm = Math.min(actKm, remainingCap);
        const pts = Math.floor(allocatableKm * XP_PER_KM);
        dailyData.distance += allocatableKm;
        rawPoints += pts;
        rows.push({
            id: id,
            type: act.type,
            distance: actKm,
            points: pts,
            date: dateStr,
        });
    });
    return {
        rawPoints: rawPoints,
        rows: rows,
        dailyData: dailyData,
        synced: rows.length,
    };
}

module.exports = {
    WALK_TYPES: WALK_TYPES,
    KM_CAP: KM_CAP,
    XP_PER_KM: XP_PER_KM,
    planWalkSync: planWalkSync,
};
