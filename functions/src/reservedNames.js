'use strict';

// Staff and brand names shared by usernamePolicy (new username picks) and the
// PvP guest battle-name check. Folding is the PvP rule: case, accents,
// look-alike letters, and digit swaps. Matching against this list is exact
// after folding, so names like bqfan, philosopher, and rufusfan stay allowed
// here. PvP may still apply its own substring list on top.

const CONFUSABLE = {
    '0': 'o', '1': 'i', '!': 'i', '|': 'i', 'l': 'i', '3': 'e', '4': 'a', '@': 'a',
    '5': 's', '$': 's', '7': 't', '8': 'b', '9': 'g', '2': 'z', '6': 'g',
    'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'і': 'i',
    'ј': 'j', 'ѕ': 's', 'һ': 'h', 'ԁ': 'd', 'ո': 'n', 'м': 'm', 'т': 't', 'в': 'b', 'н': 'h', 'к': 'k',
    'α': 'a', 'ο': 'o', 'ε': 'e', 'ι': 'i', 'ν': 'v', 'ρ': 'p', 'τ': 't', 'κ': 'k', 'η': 'n', 'μ': 'm',
};

function foldName(name) {
    let s = String(name || '');
    try { s = s.normalize('NFKD'); } catch (e) {}
    s = s.replace(/[\u0300-\u036f]/g, '').toLowerCase();
    let out = '';
    for (const ch of s) out += Object.prototype.hasOwnProperty.call(CONFUSABLE, ch) ? CONFUSABLE[ch] : ch;
    return out.replace(/[^a-z]/g, '');
}

const STAFF_RESERVED_EXACT = Object.freeze(['phil', 'rufus', 'bq', '603btc']);
const STAFF_RESERVED_EXACT_F = STAFF_RESERVED_EXACT.map(foldName);

function isExactReservedStaffName(name) {
    const f = foldName(name);
    if (!f) return false;
    return STAFF_RESERVED_EXACT_F.indexOf(f) !== -1;
}

module.exports = {
    CONFUSABLE,
    foldName,
    STAFF_RESERVED_EXACT,
    isExactReservedStaffName,
};
