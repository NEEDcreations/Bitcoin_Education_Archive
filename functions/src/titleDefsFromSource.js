'use strict';

const vm = require('vm');

// Reads the TITLE_DEFS array literal out of badges.js. Only id, title, emoji,
// requiredBadge and flavor are kept.
function extract(src) {
    const start = src.indexOf('const TITLE_DEFS = [');
    if (start < 0) throw new Error('TITLE_DEFS not found');
    const open = src.indexOf('[', start);
    const end = src.indexOf('\n];', open);
    if (end < 0) throw new Error('TITLE_DEFS end not found');
    const literal = src.slice(open, end + 2);
    const list = vm.runInNewContext('(' + literal + ')', {}, { timeout: 1000 });
    return list.filter(function (t) { return t && typeof t.id === 'string'; }).map(function (t) {
        return { id: t.id, title: t.title, emoji: t.emoji, requiredBadge: t.requiredBadge || null, flavor: t.flavor || '' };
    });
}

module.exports = { extract: extract };
