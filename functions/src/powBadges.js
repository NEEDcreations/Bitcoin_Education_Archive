'use strict';

// Proof of Walk badges, decided on the server from synced Strava rows.
// The client used to ask for these with awardBadge(), which the server treats
// as cosmetic and never records, so nobody ever held one and Fun and Fitness
// could not be completed. syncStrava now calls grantForUser after a sync.

const KM_TIERS = [
    ['pow_km_10', 10], ['pow_km_50', 50], ['pow_km_100', 100],
    ['pow_km_500', 500], ['pow_km_1000', 1000], ['pow_km_5000', 5000],
];
const STREAK_TIERS = [['pow_streak_3', 3], ['pow_streak_7', 7], ['pow_streak_30', 30]];
const MARATHON_KM = 42;

function dayKey(ms) {
    return new Date(ms).toISOString().slice(0, 10);
}

function prevKey(key) {
    const ms = Date.parse(key + 'T00:00:00Z');
    return dayKey(ms - 86400000);
}

// rows: [{ distance (km), date 'YYYY-MM-DD' }]. Returns badge ids earned.
function planPowBadges(rows, nowMs) {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return [];
    const ids = ['pow_first_step'];
    let total = 0;
    const perDay = {};
    list.forEach(function (row) {
        const km = Number(row && row.distance) || 0;
        const date = row && typeof row.date === 'string' ? row.date.slice(0, 10) : '';
        if (km > 0 && km < 1000) total += km;
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) perDay[date] = (perDay[date] || 0) + (km > 0 && km < 1000 ? km : 0);
    });
    KM_TIERS.forEach(function (tier) { if (total >= tier[1]) ids.push(tier[0]); });
    if (Object.keys(perDay).some(function (d) { return perDay[d] >= MARATHON_KM; })) ids.push('pow_marathoner');
    // Streak of consecutive days ending today or yesterday (UTC).
    const today = dayKey(Number(nowMs) || Date.now());
    let cursor = perDay[today] !== undefined ? today : prevKey(today);
    let streak = 0;
    while (perDay[cursor] !== undefined && streak < 400) {
        streak += 1;
        cursor = prevKey(cursor);
    }
    STREAK_TIERS.forEach(function (tier) { if (streak >= tier[1]) ids.push(tier[0]); });
    return ids;
}

async function grantForUser(db, adminSdk, uid, nowMs) {
    if (!uid) return [];
    const snap = await db.collection('users').doc(uid).collection('proof_of_walk').get();
    const rows = [];
    snap.forEach(function (doc) { const d = doc.data() || {}; rows.push({ distance: d.distance, date: d.date }); });
    const ids = planPowBadges(rows, nowMs);
    const { awardBadge } = require('./awardBadge');
    const out = [];
    for (let i = 0; i < ids.length; i++) {
        try {
            out.push(await awardBadge(db, adminSdk, uid, ids[i], { verified: true, source: 'proof_of_walk' }));
        } catch (err) {
            console.warn('[powBadges]', ids[i], err && err.message);
        }
    }
    return out;
}

module.exports = { planPowBadges: planPowBadges, grantForUser: grantForUser, KM_TIERS: KM_TIERS };
