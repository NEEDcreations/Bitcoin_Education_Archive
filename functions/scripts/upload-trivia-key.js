'use strict';

// Upload the daily trivia answer key to private_banks/trivia.
// The key file is a local path passed on argv. It is not committed.
// Dry-run is the default. Pass --apply to write.
//
//   node functions/scripts/upload-trivia-key.js functions/private-bank/trivia-key.json
//   node functions/scripts/upload-trivia-key.js functions/private-bank/trivia-key.json --apply
//
// The file is JSON: { "questions": [ { "q", "options", "answer", "explanation" } ] }
// Questions and options must match data/trivia-bank.js in order.
// Prints counts only. Never prints a question, an option, an answer, or an explanation.

const fs = require('fs');
const path = require('path');
const { questionsAligned } = require('../src/triviaKey');

const ROOT = path.join(__dirname, '..', '..');
const EXPECTED = path.join(ROOT, 'functions', 'private-bank', 'trivia-key.json');

function parseArgs(argv) {
    const args = argv || [];
    let file = '';
    let apply = false;
    let help = false;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--apply') apply = true;
        else if (arg === '--help' || arg === '-h') help = true;
        else if (arg && arg.charAt(0) !== '-' && !file) file = arg;
    }
    return { file: file, apply: apply, help: help };
}

function publicQuestions() {
    const src = fs.readFileSync(path.join(ROOT, 'data', 'trivia-bank.js'), 'utf8');
    return new Function(src + '\nreturn TRIVIA_BANK;')();
}

function readKeyFile(file) {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed && Array.isArray(parsed.questions)) return parsed.questions;
    if (Array.isArray(parsed)) return parsed;
    return null;
}

function planUpload(rows, pub) {
    const aligned = questionsAligned(rows, pub);
    if (!aligned) {
        return { ok: false, questions: Array.isArray(rows) ? rows.length : 0, reason: 'mismatch' };
    }
    return { ok: true, questions: aligned.length, reason: '', rows: aligned };
}

function summary(plan, apply) {
    return {
        ok: plan.ok === true,
        questions: plan.questions || 0,
        mode: apply ? 'apply' : 'dry-run',
        reason: plan.ok ? '' : (plan.reason || 'mismatch'),
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.file) {
        console.log('Usage: node functions/scripts/upload-trivia-key.js <trivia-key.json> [--apply]');
        console.log('Expected path: functions/private-bank/trivia-key.json');
        console.log('Dry-run is the default. --apply writes private_banks/trivia.');
        process.exit(args.help ? 0 : 1);
    }
    let rows = null;
    try {
        rows = readKeyFile(args.file);
    } catch (err) {
        console.log(JSON.stringify({ ok: false, questions: 0, mode: args.apply ? 'apply' : 'dry-run', reason: 'unreadable' }));
        process.exit(1);
    }
    const plan = planUpload(rows, publicQuestions());
    const report = summary(plan, args.apply);
    if (!plan.ok) {
        console.log(JSON.stringify(report));
        process.exit(1);
    }
    if (!args.apply) {
        console.log(JSON.stringify(report));
        console.log('dry-run only. Re-run with --apply to write private_banks/trivia.');
        return;
    }
    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    await db.collection('private_banks').doc('trivia').set({
        questions: plan.rows,
    });
    console.log(JSON.stringify(report));
}

if (require.main === module) {
    main().catch(function (err) {
        console.error(err && err.message ? err.message : 'upload failed');
        process.exit(1);
    });
}

module.exports = {
    EXPECTED: EXPECTED,
    parseArgs: parseArgs,
    readKeyFile: readKeyFile,
    planUpload: planUpload,
    summary: summary,
};
