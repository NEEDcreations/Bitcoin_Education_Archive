#!/usr/bin/env node
// =============================================
// Stored-XSS cleanup PLAN (dry run only).
//
// Prints what a cleanup WOULD do for documents that hold stored payloads
// (authorized white-hat PoCs from April and the Nov 8-9 pentest canaries).
// It never connects to Firestore and never writes. There is no --apply.
//
//   node tools/xss-stored-sweep-dryrun.js                       # masked built-in list
//   node tools/xss-stored-sweep-dryrun.js --targets FILE.json   # private full paths (keep outside the repo)
//   node tools/xss-stored-sweep-dryrun.js --json                # machine-readable plan
//
// A future apply step must be a separate, reviewed script run by an admin
// after Phil's OK and Security sign-off.
// =============================================
'use strict';
const fs = require('fs');

const args = require.main === module ? process.argv.slice(2) : [];
if (args.includes('--apply') || args.includes('--write') || args.includes('--commit')) {
    console.error('xss-stored-sweep-dryrun: refusing to write. This tool is dry-run only.');
    process.exit(2);
}

// Fan-out sender name confirmed by Spam/Abuse (Nov 10 9 PM export): exactly
// this 20-character string (one inner space, no leading/trailing whitespace). Related cleanups match it with
// whole-value equality only, never a prefix.
const FANOUT_SENDER = '<svg onload=alert()>';

// Related queries: only exact equality on a full value is allowed.
function checkRelated(r) {
    if (!r || !Array.isArray(r.where) || r.where.length !== 3) throw new Error('related query needs [field, "==", value]');
    if (r.where[1] !== '==') throw new Error('related query must use exact whole-value equality (==), got ' + r.where[1]);
    if (r.match && r.match !== 'exact') throw new Error('related query must be match: exact, never prefix');
    if (typeof r.where[2] !== 'string' || !r.where[2].length) throw new Error('related query needs a full non-empty value');
    return r;
}

// Masked ids (first 4 chars). Full paths live in a private file, never in git.
const BUILTIN = [
    { path: 'forum_posts/x533…', fields: ['__id__'], action: 'delete', note: 'doc-id attribute breakout; also delete replies whose postId is this id' },
    { path: 'reports/pent…', fields: ['reason', 'reporterName'], action: 'close', note: 'canary report, pending' },
    { path: 'reports/i534…', fields: ['reason', 'reportedName'], action: 'redact+close', note: 'img onerror + <b> canary, pending' },
    { path: 'admin_notifications/YmCf…', fields: ['body'], action: 'redact', note: 'textarea breakout + img onerror' },
    { path: 'dm_conversations/gqTF…/messages/8ioO…', fields: ['text'], action: 'redact', note: 'DM img onerror (subdoc)' },
    { path: 'dm_conversations/fake…', fields: ['participantNames.*'], action: 'redact', note: 'svg onload in participantNames' },
    { path: 'dm_conversations/fake…/messages/tVrR…', fields: ['senderName'], action: 'redact', note: 'svg onload senderName' },
    { path: 'notifications/3BDD…', fields: ['senderName', 'message'], action: 'delete', note: 'senderName fan-out notification (recipientId=fake-recipient, type=dm); senderName confirmed by Spam/Abuse',
      related: [{ collection: 'notifications', where: ['senderName', '==', FANOUT_SENDER], match: 'exact', action: 'delete', note: 'exact whole-value equality only; a copy with trailing text does not match and is handled by its own id' }] },
    { path: 'marketplace/6dpL…', fields: ['sellerRank'], action: 'redact', note: 'listing already deleted' },
    { path: 'marketplace/lYiH…', fields: ['imageUrl'], action: 'clear', note: 'CSS/attribute breakout, deleted listing' },
    { path: 'marketplace/ugpe…', fields: ['imageUrl'], action: 'clear', note: 'low-risk CSS breakout, deleted listing' },
    { path: 'reports/i617…', fields: ['reason', 'reportedName', 'reporterName'], action: 'close', note: 'planted by pentest account A2 (nUOj…)' },
    { path: 'shoutout_claims/shou…', fields: [], action: 'delete', note: 'server-written claim for planted forum post i617… (A2); collection is server-only' },
];

// What a redact would store instead: the visible text with markup removed.
function proposeClean(v) {
    if (v === null || v === undefined) return v;
    return String(v)
        .replace(/<\/?[a-z][^>]*>/gi, '')
        .replace(/[<>]/g, '')
        .replace(/\bon[a-z]+\s*=/gi, '')
        .replace(/javascript\s*:/gi, '')
        .trim()
        .slice(0, 500);
}
const PAYLOAD_RE = /<\s*\/?\s*(script|img|svg|iframe|object|embed|textarea|style|a|b|details|video|audio|body|math)\b|\bon[a-z]+\s*=|javascript\s*:|\balert\s*\(|url\s*\(\s*['"]?\s*\)|['"]\)\s*[;}]/i;

function loadTargets() {
    const i = args.indexOf('--targets');
    if (i === -1) return { source: 'built-in (masked ids)', targets: BUILTIN };
    const file = args[i + 1];
    if (!file) { console.error('--targets needs a file'); process.exit(2); }
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { source: file, targets: j.targets || [] };
}

function mask(p) {
    return String(p).split('/').map((seg, k) => (k % 2 === 1 && seg.length > 4 ? seg.slice(0, 4) + '…' : seg)).join('/');
}

function main() {
const { source, targets } = loadTargets();
const plan = targets.map((t) => ({
    path: t.path,
    shown: args.includes('--full') ? t.path : mask(t.path),
    action: t.action,
    fields: t.fields || [],
    note: t.note || '',
    related: (t.related || []).map(checkRelated),
    idHasPayload: PAYLOAD_RE.test(String(t.path)),
}));

if (args.includes('--json')) {
    console.log(JSON.stringify({ dryRun: true, source, plan: plan.map(({ path, ...rest }) => (args.includes('--full') ? { path, ...rest } : rest)) }, null, 2));
    return;
}

console.log('Stored-XSS cleanup plan (DRY RUN, nothing is read or written)');
console.log('Targets from: ' + source + '\n');
let n = 0;
for (const p of plan) {
    n++;
    console.log(`${n}. ${p.shown}`);
    console.log(`   action: ${p.action}${p.fields.length ? '   fields: ' + p.fields.join(', ') : ''}`);
    if (p.idHasPayload) console.log('   doc id itself carries markup: cannot be renamed; delete and re-create under an auto id if the content is worth keeping');
    if (p.note) console.log('   note: ' + p.note);
    for (const r of p.related) console.log(`   related: ${r.action} ${r.collection} where ${r.where[0]} == ${JSON.stringify(r.where[2])} (exact whole value, ${r.where[2].length} chars; not a prefix match)${r.note ? ' (' + r.note + ')' : ''}`);
    console.log('   redact = replace the field with its text minus markup, e.g. ' + JSON.stringify(proposeClean('<img src=x onerror=alert(1)>hello')) + ' -> keep audit trail in the admin log');
}
console.log(`\n${n} target(s). Not applied. Apply only with Phil's OK + Security sign-off, via a separate reviewed admin script.`);
}

module.exports = { proposeClean, PAYLOAD_RE, mask, checkRelated, FANOUT_SENDER };
if (require.main === module) main();
