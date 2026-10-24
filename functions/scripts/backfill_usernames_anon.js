'use strict';

// Same planner as backfill_usernames.js. A shared name stays with the
// account that has a non-anonymous provider (email, Google, or any other
// linked provider), then more points, then the most recent activity.
// Account age is only the last tiebreaker. Dry-run unless --apply.
// Prints counts only. Never prints names, emails, or other profile fields.

const backfill = require('./backfill_usernames');

if (require.main === module) {
    backfill.main().then(function () {
        process.exit(0);
    }).catch(function () {
        console.error('backfill failed');
        process.exit(1);
    });
}

module.exports = backfill;
