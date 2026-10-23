'use strict';

// Proposed badge XP. functions/src/badge-xp.proposed.csv is the source.
// badge-xp.json is that sheet as data. Server grants and the badge UI both
// read this module (the UI through the generated catalog).

const table = require('./badge-xp.json');

function row(id) {
    return id && table.badges[id] ? table.badges[id] : null;
}

function has(id) {
    return !!row(id);
}

function xpOf(id) {
    const found = row(id);
    return found ? (Number(found.xp) || 0) : null;
}

function oldXpOf(id) {
    const found = row(id);
    if (!found || found.oldXp == null) return null;
    return Number(found.oldXp) || 0;
}

function tierOf(id) {
    const found = row(id);
    return found ? found.tier : '';
}

function ids() {
    return Object.keys(table.badges);
}

module.exports = {
    table: table,
    row: row,
    has: has,
    xpOf: xpOf,
    oldXpOf: oldXpOf,
    tierOf: tierOf,
    ids: ids,
};
