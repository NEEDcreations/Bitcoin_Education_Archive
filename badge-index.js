/* Shared badge and title catalog for search, Nacho, and the display popover.
   Descriptions already in the catalog are used as-is. Missing text gets a
   neutral fallback. Draft wording is not wired in until Phil approves it.
   Secret (hidden) badges are omitted from public search and Nacho. */
(function (root, factory) {
    var api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.BQBadgeIndex = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
    var FALLBACK_DESC = 'A Bitcoin Quest badge. Open Badges to track your progress.';
    var FALLBACK_HOW = 'Keep exploring the app to earn this. A fuller how-to will appear once the official description is reviewed.';
    var TITLE_HOW = {
        core_contributor: 'Spin the daily wheel on 7 New York calendar days in a row during the same BIP Breakthrough week, which starts Monday at midnight Eastern. That merges the week\'s BIP, grants its badge, and gives you the Core Contributor title for 7 days. After it expires, complete another BIP week to earn it again. You can hide the title without losing it.'
    };

    function catalogMap() {
        if (root && root.BADGE_CATALOG) return root.BADGE_CATALOG;
        return {};
    }
    function titleList() {
        if (root && Array.isArray(root.TITLE_DEFS)) return root.TITLE_DEFS;
        return [];
    }
    function collections() {
        if (root && Array.isArray(root.BADGE_COLLECTION_DEFS)) return root.BADGE_COLLECTION_DEFS;
        if (root && Array.isArray(root.BADGE_COLLECTIONS)) return root.BADGE_COLLECTIONS;
        return [];
    }

    function normalize(value) {
        var s = String(value == null ? '' : value);
        if (typeof s.normalize === 'function') s = s.normalize('NFKD');
        s = s.replace(/\p{M}/gu, '');
        s = s.toLowerCase();
        s = s.replace(/[_\-/]+/g, ' ');
        s = s.replace(/\s+/g, ' ').trim();
        return s;
    }

    function isSecretFlag(row) {
        return !!(row && (row.hidden || row.secret));
    }

    function titleIds() {
        var set = {};
        titleList().forEach(function (t) { if (t && t.id) set[t.id] = true; });
        collections().forEach(function (col) {
            if (col && col.title && col.title.id) set[col.title.id] = true;
        });
        set.core_contributor = true;
        return set;
    }

    function entryFromCatalog(id, raw, titles) {
        var name = (raw && raw.name) || id;
        var desc = String((raw && (raw.desc || raw.flavor)) || '').trim();
        var hidden = !!(raw && raw.hidden);
        var kind = titles[id] ? 'title' : 'badge';
        var how = '';
        if (TITLE_HOW[id]) how = TITLE_HOW[id];
        else if (desc) how = desc;
        else how = FALLBACK_HOW;
        return {
            id: id,
            kind: kind,
            name: name,
            emoji: (raw && raw.emoji) || '',
            desc: desc || FALLBACK_DESC,
            how: how,
            secret: hidden,
            hidden: hidden,
            xp: (raw && typeof raw.xp === 'number') ? raw.xp : (raw && raw.pts) || 0,
            category: (raw && raw.category) || '',
            hasOfficialDesc: !!desc
        };
    }

    function allEntries() {
        var titles = titleIds();
        var out = [];
        var seen = {};
        var cat = catalogMap();
        Object.keys(cat).forEach(function (id) {
            seen[id] = true;
            out.push(entryFromCatalog(id, cat[id], titles));
        });
        titleList().forEach(function (t) {
            if (!t || !t.id || seen[t.id]) {
                if (t && t.id && seen[t.id] && t.flavor) {
                    for (var i = 0; i < out.length; i++) {
                        if (out[i].id === t.id) {
                            if (!out[i].hasOfficialDesc && t.flavor) {
                                out[i].desc = t.flavor;
                                out[i].how = TITLE_HOW[t.id] || t.flavor;
                                out[i].hasOfficialDesc = true;
                            }
                            if (t.emoji && !out[i].emoji) out[i].emoji = t.emoji;
                            if (t.title) out[i].name = t.title;
                            out[i].kind = 'title';
                        }
                    }
                }
                return;
            }
            seen[t.id] = true;
            out.push({
                id: t.id,
                kind: 'title',
                name: t.title || t.name || t.id,
                emoji: t.emoji || '',
                desc: t.flavor || t.desc || FALLBACK_DESC,
                how: TITLE_HOW[t.id] || t.flavor || t.desc || FALLBACK_HOW,
                secret: false,
                hidden: false,
                xp: 0,
                category: 'Title',
                hasOfficialDesc: !!(t.flavor || t.desc)
            });
        });
        if (!seen.core_contributor) {
            out.push({
                id: 'core_contributor',
                kind: 'title',
                name: 'Core Contributor',
                emoji: '🔧',
                desc: 'Merged this week\'s BIP after 7 daily spins. Bit Devs energy.',
                how: TITLE_HOW.core_contributor,
                secret: false,
                hidden: false,
                xp: 0,
                category: 'Title',
                hasOfficialDesc: true
            });
        }
        return out;
    }

    function get(id) {
        var key = String(id || '');
        var list = allEntries();
        for (var i = 0; i < list.length; i++) {
            if (list[i].id === key) return list[i];
        }
        return null;
    }

    function search(query, opts) {
        var options = opts || {};
        var q = normalize(query);
        if (!q || q.length < 2) return [];
        var stop = { a:1, an:1, the:1, is:1, are:1, was:1, were:1, what:1, whats:1, who:1, how:1, do:1, does:1, did:1, i:1, me:1, my:1, to:1, of:1, in:1, on:1, for:1, and:1, or:1, can:1, you:1, your:1, it:1, this:1, that:1, with:1, about:1 };
        var tokens = q.split(' ').filter(function (t) { return t && !stop[t]; });
        if (!tokens.length) tokens = q.split(' ').filter(Boolean);
        var earned = options.earnedIds || {};
        var hits = [];
        allEntries().forEach(function (row) {
            if (row.secret && !earned[row.id] && !options.includeSecret) return;
            var blob = normalize([row.id, row.name, row.desc, row.how, row.category, row.kind].join(' '));
            var ok = true;
            for (var t = 0; t < tokens.length; t++) {
                if (blob.indexOf(tokens[t]) === -1) { ok = false; break; }
            }
            if (!ok) return;
            var name = normalize(row.name);
            var score = 5;
            if (name === q) score = 0;
            else if (name.indexOf(q) === 0) score = 1;
            else if (name.indexOf(q) !== -1) score = 2;
            else if (normalize(row.id).indexOf(q) !== -1) score = 3;
            hits.push({ entry: row, score: score });
        });
        hits.sort(function (a, b) {
            if (a.score !== b.score) return a.score - b.score;
            return (a.entry.name || '').localeCompare(b.entry.name || '');
        });
        var limit = options.limit > 0 ? options.limit : 12;
        return hits.slice(0, limit).map(function (h) { return h.entry; });
    }

    function isBitcoinCoreDevQuestion(query) {
        var s = normalize(query);
        return /bitcoin core (contributor|developer)s?/.test(s)
            || /who develops bitcoin/.test(s)
            || /how many bitcoin developers/.test(s);
    }

    function nachoAnswer(query) {
        if (isBitcoinCoreDevQuestion(query)) return null;
        var hits = search(query, { includeSecret: false, limit: 3 });
        if (!hits.length) return null;
        var top = hits[0];
        var name = normalize(top.name);
        var q = normalize(query);
        var strong = name === q || name.indexOf(q) !== -1 || q.indexOf(name) !== -1
            || normalize(top.id).indexOf(q) !== -1
            || /badge|title|how (do i|to) (earn|get|unlock)|what is/.test(q);
        if (!strong && hits[0] && q.split(' ').length < 2) return null;
        var parts = [top.emoji ? top.emoji + ' ' : '', top.name, ' is a Bitcoin Quest ', (top.kind === 'title' ? 'title' : 'badge'), '. ', top.desc];
        if (top.how && top.how !== top.desc) parts.push(' ', top.how);
        if (hits.length > 1) {
            parts.push(' Related: ', hits.slice(1).map(function (h) { return h.name; }).join(', '), '.');
        }
        return { id: top.id, kind: top.kind, title: top.name, answer: parts.join(''), entries: hits };
    }

    function toMs(v) {
        if (!v) return 0;
        if (typeof v === 'number') return v;
        if (typeof v.toMillis === 'function') return v.toMillis();
        if (v instanceof Date) return v.getTime();
        return Number(v) || 0;
    }
    function coreContributorVisible(user, nowMs) {
        if (!user) return false;
        if (user.showCoreContributor === false) return false;
        return toMs(user.coreContributorUntil) > (Number(nowMs) || Date.now());
    }

    return {
        FALLBACK_DESC: FALLBACK_DESC,
        FALLBACK_HOW: FALLBACK_HOW,
        normalize: normalize,
        allEntries: allEntries,
        get: get,
        search: search,
        isBitcoinCoreDevQuestion: isBitcoinCoreDevQuestion,
        nachoAnswer: nachoAnswer,
        coreContributorVisible: coreContributorVisible,
        toMs: toMs
    };
});
