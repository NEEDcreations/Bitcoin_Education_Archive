'use strict';

// Validates the private exam bank. Prints counts only. Never prints a question.
const fs = require('fs');
const path = require('path');
const { validateBank } = require('../src/scholarBankShape');

const file = process.argv[2] || path.join(__dirname, '..', 'private-bank', 'scholar-questions.json');

let parsed;
try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (err) {
    console.log('properties 0');
    console.log('technical 0');
    console.error('invalid');
    process.exit(1);
}

const check = validateBank(parsed);
console.log('properties ' + check.counts.properties);
console.log('technical ' + check.counts.technical);
if (!check.ok) {
    console.error('invalid');
    process.exit(1);
}
console.log('ok');
