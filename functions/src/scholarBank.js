'use strict';

const fs = require('fs');
const path = require('path');
const { validateBank } = require('./scholarBankShape');

const DEFAULT_PATH = path.join(__dirname, '..', 'private-bank', 'scholar-questions.json');

let bank = null;
let readyFlag = false;
let loaded = false;

function bankPath() {
    return process.env.SCHOLAR_BANK_PATH || DEFAULT_PATH;
}

// Loaded on the first start or grade, then cached. Requiring this module
// does not read the file, so other functions can boot without the bank.
// A missing or invalid file stays failed for the life of the process.
function loadBank() {
    if (loaded) return;
    loaded = true;
    readyFlag = false;
    bank = null;
    const file = bankPath();
    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
        console.error('[SCHOLAR] exam bank unavailable');
        return;
    }
    const check = validateBank(parsed);
    if (!check.ok) {
        console.error('[SCHOLAR] exam bank unavailable');
        return;
    }
    bank = parsed;
    readyFlag = true;
}

function ready() {
    loadBank();
    return readyFlag;
}

function getBank() {
    loadBank();
    return bank;
}

module.exports = {
    DEFAULT_PATH: DEFAULT_PATH,
    bankPath: bankPath,
    ready: ready,
    getBank: getBank,
};
