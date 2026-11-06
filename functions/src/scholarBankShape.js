'use strict';

// Shape check for the private exam bank. Error text never includes a question.
const EXPECTED_COUNTS = { properties: 213, technical: 165 };

function isText(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function isPlaceholder(item) {
    if (!item || typeof item !== 'object') return false;
    if (item.q === 'The question' || item.a === 'The correct answer') return true;
    if (!Array.isArray(item.w)) return false;
    for (let i = 0; i < item.w.length; i++) {
        if (/^Distractor [1-4]$/.test(String(item.w[i] || ''))) return true;
    }
    return false;
}

function validateQuestion(item, pool) {
    const errors = [];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
        errors.push(pool + ' question is not an object');
        return errors;
    }
    const idOk = pool === 'technical' ? /^t\d{3}$/.test(String(item.id || '')) : /^p\d{3}$/.test(String(item.id || ''));
    if (!idOk) errors.push(pool + ' question id is invalid');
    if (!isText(item.q)) errors.push(pool + ' question is missing text');
    if (!isText(item.a)) errors.push(pool + ' question is missing a correct answer');
    if (!Array.isArray(item.w) || item.w.length !== 4 || item.w.some(function (choice) { return !isText(choice); })) {
        errors.push(pool + ' question is missing four options');
    } else if (item.w.indexOf(item.a) !== -1) {
        errors.push(pool + ' repeats the correct option');
    }
    if (isPlaceholder(item)) errors.push(pool + ' contains a placeholder');
    return errors;
}

function validateBank(bank) {
    const errors = [];
    const counts = { properties: 0, technical: 0 };
    if (!bank || typeof bank !== 'object' || Array.isArray(bank)) {
        return { ok: false, counts: counts, errors: ['bank is not an object'] };
    }
    ['properties', 'technical'].forEach(function (pool) {
        const list = bank[pool];
        if (!Array.isArray(list)) {
            errors.push(pool + ' is missing');
            return;
        }
        counts[pool] = list.length;
        if (list.length !== EXPECTED_COUNTS[pool]) {
            errors.push(pool + ' count is ' + list.length + ', expected ' + EXPECTED_COUNTS[pool]);
        }
        const seen = {};
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            const rowErrors = validateQuestion(item, pool);
            for (let e = 0; e < rowErrors.length; e++) {
                if (errors.indexOf(rowErrors[e]) === -1) errors.push(rowErrors[e]);
            }
            const id = item && item.id;
            if (id) {
                if (seen[id]) errors.push(pool + ' has a duplicate id');
                seen[id] = true;
            }
        }
    });
    return { ok: errors.length === 0, counts: counts, errors: errors };
}

module.exports = {
    EXPECTED_COUNTS: EXPECTED_COUNTS,
    validateBank: validateBank,
};
