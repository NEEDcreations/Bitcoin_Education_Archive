'use strict';

// Shared kids-account checks. The confirmAge18 callable and ads.js (PR #401)
// must use this same list. tests/test-kids-account.js keeps the copies and,
// when ads.js is present, the flag lists in sync.

var KIDS_BOOL_FLAGS = ['isMinor', 'under13', 'kids', 'isKids', 'kidsMode'];
var KIDS_AGE_BANDS = ['under13', 'minor', 'child', 'kids', 'kid'];
var KIDS_ACCOUNT_LABELS = ['kids', 'kid', 'child', 'family-child', 'minor'];

function accountLabel(user) {
    if (!user) return '';
    return String(
        user.accountType || user.planType || user.plan || user.role || user.mode || ''
    ).toLowerCase();
}

function ageBandOf(user) {
    if (!user) return '';
    return String(user.ageBand || user.age_band || '').toLowerCase();
}

function isKidsAccount(user) {
    if (!user) return false;
    if (user.isMinor === true || user.under13 === true) return true;
    if (user.kids === true || user.isKids === true || user.kidsMode === true) return true;
    var band = ageBandOf(user);
    var i;
    for (i = 0; i < KIDS_AGE_BANDS.length; i++) {
        if (band === KIDS_AGE_BANDS[i]) return true;
    }
    var label = accountLabel(user);
    for (i = 0; i < KIDS_ACCOUNT_LABELS.length; i++) {
        if (label === KIDS_ACCOUNT_LABELS[i]) return true;
    }
    return false;
}

var api = {
    isKidsAccount: isKidsAccount,
    accountLabel: accountLabel,
    ageBandOf: ageBandOf,
    KIDS_BOOL_FLAGS: KIDS_BOOL_FLAGS,
    KIDS_AGE_BANDS: KIDS_AGE_BANDS,
    KIDS_ACCOUNT_LABELS: KIDS_ACCOUNT_LABELS
};

if (typeof module === 'object' && module.exports) {
    module.exports = api;
}
if (typeof window !== 'undefined') {
    window.bqKidsAccount = api;
}
