// One peership table for the keys modal and profiles.
// Gift counts match functions/src/peerLevel.js. Level XP stays server-side.
var PEERSHIP_LEVELS = [
    { level: 1, name: 'Unconfirmed', gifts: 0 },
    { level: 2, name: 'Opening Channel', gifts: 1 },
    { level: 3, name: 'Routing Nodes', gifts: 21 },
    { level: 4, name: 'Adjusted Fees', gifts: 44 },
    { level: 5, name: 'Balanced Liquidity', gifts: 144 },
    { level: 6, name: 'Wumbo Channel', gifts: 210 }
];

window.peershipLevelView = function(entry) {
    var row = entry && typeof entry === 'object' ? entry : null;
    var level = row ? Number(row.level) : NaN;
    if (!row || !isFinite(level) || level < 1) {
        return { chip: 'New', title: 'No peership level yet', name: '', line: 'Peership not started', level: 0, gifts: null, next: null };
    }
    level = Math.min(6, Math.floor(level));
    var known = null;
    for (var i = 0; i < PEERSHIP_LEVELS.length; i++) {
        if (PEERSHIP_LEVELS[i].level === level) known = PEERSHIP_LEVELS[i];
    }
    var name = row.levelName ? String(row.levelName).replace(/\s+/g, ' ').trim().slice(0, 40) : '';
    if (!name && known) name = known.name;
    var gifts = (typeof row.giftsExchanged === 'number' && isFinite(row.giftsExchanged)) ? Math.max(0, Math.floor(row.giftsExchanged)) : null;
    var next = null;
    if (gifts != null) {
        for (var j = 0; j < PEERSHIP_LEVELS.length; j++) {
            if (PEERSHIP_LEVELS[j].gifts > gifts) { next = PEERSHIP_LEVELS[j].gifts; break; }
        }
    }
    var chip = 'Lv ' + level;
    var line = 'Peership · ' + chip + (name ? ' · ' + name : '');
    if (gifts != null) line += ' · ' + gifts + (next != null ? '/' + next : '');
    return { chip: chip, title: name ? (chip + ' · ' + name) : chip, name: name, line: line, level: level, gifts: gifts, next: next };
};
