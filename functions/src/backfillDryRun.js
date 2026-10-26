'use strict';

// Shared dry-run lines for badge backfill scripts. A uid longer than 8
// characters is cut so a log can be reviewed without printing the full id.

function truncateUid(uid) {
    const id = String(uid || '');
    if (id.length <= 8) return id;
    return id.slice(0, 8) + '...';
}

function userLine(uid, xp, favor) {
    return 'user ' + truncateUid(uid) + ' xp ' + (Number(xp) || 0) + ' favor ' + (Number(favor) || 0);
}

function grandLine(xp, favor) {
    return 'grand xp ' + (Number(xp) || 0) + ' favor ' + (Number(favor) || 0);
}

function parseMode(argv) {
    const list = argv || [];
    const help = list.indexOf('--help') !== -1 || list.indexOf('-h') !== -1;
    const applyFlag = list.indexOf('--apply') !== -1;
    const dryFlag = list.indexOf('--dry-run') !== -1;
    const apply = applyFlag && !dryFlag;
    return { help: help, apply: apply, dryRun: !apply };
}

module.exports = {
    truncateUid: truncateUid,
    userLine: userLine,
    grandLine: grandLine,
    parseMode: parseMode,
};
