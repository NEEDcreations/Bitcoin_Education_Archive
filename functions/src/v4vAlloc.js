'use strict';

// Split a V4V tip across the listed shares so the amounts sum to the tip.
const V4V_SPLITS_MAX = 10;

function v4vSplitsOk(list) {
    if (!Array.isArray(list) || list.length < 1 || list.length > V4V_SPLITS_MAX) return false;
    for (let i = 0; i < list.length; i++) {
        const s = list[i] && list[i].split;
        if (typeof s !== 'number' || !Number.isSafeInteger(s) || s < 1) return false;
    }
    return true;
}

function v4vPayableSplits(list) {
    if (!Array.isArray(list)) return null;
    const payable = [];
    for (let i = 0; i < list.length; i++) {
        const row = list[i];
        if (row && row.split === 0) continue;
        payable.push(row);
    }
    if (!v4vSplitsOk(payable)) return null;
    return payable;
}

function allocateV4vSats(amountSats, splits) {
    const amount = Number(amountSats);
    if (!Number.isSafeInteger(amount) || amount < 1 || !v4vSplitsOk(splits)) return null;
    const totalSplit = splits.reduce(function(s, r) { return s + r.split; }, 0);
    if (!(totalSplit > 0) || !Number.isFinite(totalSplit)) return null;
    const rows = splits.map(function(r, i) {
        const exact = amount * (r.split / totalSplit);
        const floor = Math.floor(exact);
        return { i: i, floor: floor, frac: exact - floor };
    });
    let rem = amount - rows.reduce(function(s, x) { return s + x.floor; }, 0);
    if (rem < 0 || rem > rows.length) return null;
    const order = rows.slice().sort(function(a, b) {
        return (b.frac - a.frac) || (a.i - b.i);
    });
    const extra = new Array(splits.length).fill(0);
    for (let k = 0; k < rem; k++) extra[order[k].i] = 1;
    return rows.map(function(x) { return x.floor + extra[x.i]; });
}

module.exports = {
    V4V_SPLITS_MAX: V4V_SPLITS_MAX,
    v4vSplitsOk: v4vSplitsOk,
    v4vPayableSplits: v4vPayableSplits,
    allocateV4vSats: allocateV4vSats,
};
