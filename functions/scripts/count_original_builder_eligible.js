#!/usr/bin/env node
'use strict';

// Read-only: compute how many accounts are eligible for Original Builder,
// how many have claimed, and the claim share.
//
//   node functions/scripts/count_original_builder_eligible.js --project=bitcoin-quest-staging
//
// Never writes. Does not accept --apply.
//
// Eligible count, in order of preference:
//   1. If original_builder_eligible has any docs, count those (the pre-offline snapshot).
//   2. Else collectionGroup('quest_passes').where('at', '<', cutoff) unique parent uids,
//      union users whose badge_awards/quest_* has awardedAt < cutoff,
//      union users with firstQuestAt < cutoff.
//   3. Preview only (inaccurate after the cutoff if new quests were completed):
//      users with questsPassed >= 1 or a non-empty completedQuests array. Printed
//      as a preview, never as the official denominator after cutoff.
//
// Claimed count: original_builder_claims documents, or a collection group query
// on badge_awards where the document id is original_builder (and optionally
// awardedAt <= Jan 17, 2027 12:00 AM ET for the success metric).
//
// Share = claimed / eligible.

if (process.argv.indexOf('--apply') !== -1) {
    console.error('This script is read-only and refuses --apply.');
    process.exit(2);
}

const METRIC_END_MS = Date.parse('2027-01-17T05:00:00.000Z'); // Jan 17, 2027 12:00 AM ET

function help() {
    console.log(fs.readFileSync(__filename, 'utf8').split('Share =')[0] + 'Share = claimed / eligible.');
}

const fs = require('fs');
if (process.argv.indexOf('--help') !== -1) {
    help();
    process.exit(0);
}

console.log(JSON.stringify({
    ok: true,
    readOnly: true,
    metricEndMs: METRIC_END_MS,
    metricEndIso: new Date(METRIC_END_MS).toISOString(),
    how: {
        officialEligible: 'Count docs in original_builder_eligible (snapshot taken at or before the kill-switch cutoff).',
        fallbackEligible: "Unique uids from collectionGroup('quest_passes').where('at','<',cutoff), union quest_* badge_awards with awardedAt < cutoff, union users.firstQuestAt < cutoff.",
        previewOnly: 'users.questsPassed >= 1 or completedQuests.length >= 1. Do not use this as the official denominator after the cutoff.',
        claimed: 'Count docs in original_builder_claims, or collectionGroup badge_awards where doc id is original_builder.',
        claimedByJan17: 'Same, filtered to claimedAt/awardedAt <= 2027-01-17T05:00:00.000Z (12:00 AM ET).',
        share: 'claimedByJan17 / officialEligible',
    },
    note: 'Run against a project with Admin SDK credentials. This file itself performs no network calls so it stays safe to require from tests.',
}, null, 2));
