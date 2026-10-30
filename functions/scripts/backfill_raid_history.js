'use strict';

// Snapshot past raid bosses into raid_history/{bossId}.
// Dry-run is the default. Pass --apply to write.
// Also fills a missing giveaway winner username when that winner was
// recorded after the history doc. Does not print names, emails, or ids.
//
//   node functions/scripts/backfill_raid_history.js
//   node functions/scripts/backfill_raid_history.js --apply

const path = require('path');

function parseArgs(argv) {
    return {
        help: argv.indexOf('--help') !== -1 || argv.indexOf('-h') !== -1,
        apply: argv.indexOf('--apply') !== -1,
    };
}

function loadHistory() {
    return require(path.join(__dirname, '..', 'src', 'raidHistory'));
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log('Usage: node functions/scripts/backfill_raid_history.js [--apply]');
        console.log('Dry-run is the default. --apply writes missing raid_history docs and missing winner names.');
        return;
    }
    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    const history = loadHistory();
    const result = await history.backfillRaidHistory(db, admin, new Date(), { apply: args.apply });
    if (args.apply) {
        console.log('created ' + result.created + ' history docs');
        console.log('filled ' + result.filledWinners + ' giveaway winners');
    } else {
        console.log('would create ' + result.wouldCreate + ' history docs');
        console.log('would fill ' + result.wouldFillWinners + ' giveaway winners');
    }
}

if (require.main === module) {
    main().catch(function (err) {
        console.error('Auth or read unavailable. No data was written.');
        process.exit(1);
    });
}

module.exports = { parseArgs: parseArgs };
