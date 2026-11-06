'use strict';

// Combo tiers come from server-recorded zones for the offset day.
// A client comboTier is not an input. Crossing 3, 5, and 8 zones
// grants combo_trio, combo_mega, and combo_legend once each.

const { awardBadge } = require('./awardBadge');

const ZONES = {
    pvp: true,
    spin: true,
    tctv: true,
    forum: true,
    prediction: true,
    chat: true,
    sf: true,
    beats: true,
};

const TIERS = [
    { n: 3, id: 'combo_trio' },
    { n: 5, id: 'combo_mega' },
    { n: 8, id: 'combo_legend' },
];

function planCombo(prev, zone) {
    const state = {
        zones: Object.assign({}, (prev && prev.zones) || {}),
        awarded: Object.assign({}, (prev && prev.awarded) || {}),
    };
    const known = Object.keys(state.zones).filter(function (key) { return state.zones[key] && ZONES[key]; });
    known.forEach(function (key) { state.zones[key] = true; });
    if (!ZONES[zone]) {
        return { state: state, grant: [], fresh: false, count: known.length };
    }
    const fresh = !state.zones[zone];
    state.zones[zone] = true;
    const count = Object.keys(state.zones).filter(function (key) { return state.zones[key]; }).length;
    const grant = [];
    TIERS.forEach(function (tier) {
        if (count >= tier.n && !state.awarded[tier.id]) {
            state.awarded[tier.id] = true;
            grant.push(tier.id);
        }
    });
    return { state: state, grant: grant, fresh: fresh, count: count };
}

async function noteComboZone(db, adminSdk, uid, zone, day) {
    if (!uid || !day || !ZONES[zone]) return { noted: false, grant: [] };
    const ref = db.collection('users').doc(uid).collection('daily_action_counts').doc(day + '_combo');
    let plan = planCombo(null, zone);
    await db.runTransaction(async function (t) {
        const snap = await t.get(ref);
        const prev = snap.exists ? (snap.data() || {}) : {};
        plan = planCombo(prev, zone);
        if (!plan.fresh) return;
        t.set(ref, {
            zones: plan.state.zones,
            awarded: prev.awarded || {},
            day: day,
        }, { merge: true });
    });
    if (!plan.grant.length) return { noted: true, grant: [] };
    const done = [];
    for (let i = 0; i < plan.grant.length; i++) {
        const id = plan.grant[i];
        try {
            const result = await awardBadge(db, adminSdk, uid, id, { verified: true, source: 'combo', day: day });
            if (result && (result.granted || result.reason === 'already' || result.reason === 'legacy')) done.push(id);
        } catch (e) { /* a later zone note retries an unstamped tier */ }
    }
    if (done.length) {
        await db.runTransaction(async function (t) {
            const snap = await t.get(ref);
            const prev = snap.exists ? (snap.data() || {}) : {};
            const awarded = Object.assign({}, prev.awarded || {});
            done.forEach(function (id) { awarded[id] = true; });
            t.set(ref, { awarded: awarded }, { merge: true });
        });
    }
    return { noted: true, grant: done };
}

module.exports = {
    ZONES: ZONES,
    TIERS: TIERS,
    planCombo: planCombo,
    noteComboZone: noteComboZone,
};
