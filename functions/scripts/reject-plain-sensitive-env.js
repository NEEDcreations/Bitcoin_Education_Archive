#!/usr/bin/env node
'use strict';

// Fail when functions/.env* would inject a sensitive name into every
// function. Prints the file and the key name only. Never prints a value,
// the rest of the line, or a matched secret.
const fs = require('fs');
const path = require('path');
const { PLAIN_ENV_NAMES } = require('../src/sensitiveSecrets');

const root = path.join(__dirname, '..');
const names = new Set(PLAIN_ENV_NAMES);
const hits = [];

function consider(file) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); }
    catch (err) { return; }
    const lines = text.split(/\r?\n/);
    const seen = {};
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.charAt(0) === '#') continue;
        const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
        if (!match || !names.has(match[1]) || seen[match[1]]) continue;
        seen[match[1]] = true;
        hits.push(path.basename(file) + ': ' + match[1]);
    }
}

const entries = fs.readdirSync(root);
for (let i = 0; i < entries.length; i++) {
    const name = entries[i];
    if (name === '.env' || name.startsWith('.env.')) consider(path.join(root, name));
}

if (!hits.length) {
    console.log('plain sensitive env: none');
    process.exit(0);
}
console.error('Remove these names from functions env files before deploy:');
hits.forEach(function (hit) { console.error('  ' + hit); });
console.error('Copy values into Secret Manager without printing them, then delete the lines.');
process.exit(1);
