/* Browse Topics search.
   Case-insensitive, punctuation-insensitive, with light stemming,
   prefix matches, and one-edit typos on words of 5+ letters.
   Rank: exact title, title word, synonym/intent, then content.
   The index is data only. Topic files are not modified. */
(function (root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.TopicSearch = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
    var STOP = {
        a: 1, an: 1, the: 1, to: 1, of: 1, for: 1, and: 1, or: 1, in: 1, on: 1,
        my: 1, your: 1, you: 1, with: 1, do: 1, i: 1, me: 1, can: 1, please: 1,
        about: 1, from: 1, at: 1, it: 1, this: 1, that: 1, be: 1, is: 1, are: 1,
        was: 1, were: 1, we: 1, our: 1, its: 1, into: 1, just: 1, some: 1, any: 1,
        not: 1, by: 1, as: 1, if: 1, so: 1, than: 1, then: 1, too: 1, very: 1
    };
    var IRREGULAR = {
        bought: 'buy', buying: 'buy', buys: 'buy',
        paid: 'pay', paying: 'pay', pays: 'pay',
        spent: 'spend', spending: 'spend', spends: 'spend',
        sold: 'sell', selling: 'sell', sells: 'sell',
        lost: 'lose', losing: 'lose', loses: 'lose',
        sent: 'send', sending: 'send', sends: 'send',
        ran: 'run', running: 'run', runs: 'run',
        got: 'get', getting: 'get', gets: 'get',
        kept: 'keep', keeping: 'keep', keeps: 'keep',
        made: 'make', making: 'make', makes: 'make',
        found: 'find', finding: 'find', finds: 'find'
    };

    function normalize(value) {
        var s = String(value == null ? '' : value);
        if (typeof s.normalize === 'function') s = s.normalize('NFKD');
        try { s = s.replace(/\p{M}/gu, ''); } catch (e) {}
        s = s.replace(/[\u2018\u2019\u201A\u201B\u2032]/g, '');
        s = s.toLowerCase();
        s = s.replace(/[^a-z0-9]+/g, ' ');
        s = s.replace(/\s+/g, ' ').trim();
        return s;
    }

    function unique(list) {
        var out = [];
        var seen = {};
        var i;
        for (i = 0; i < list.length; i++) {
            if (!list[i] || seen[list[i]]) continue;
            seen[list[i]] = 1;
            out.push(list[i]);
        }
        return out;
    }

    function stemKeys(word) {
        var keys = [word];
        if (IRREGULAR[word]) keys.push(IRREGULAR[word]);
        if (word.length > 4 && word.slice(-3) === 'ies') keys.push(word.slice(0, -3) + 'y');
        if (word.length > 3 && word.slice(-2) === 'es') keys.push(word.slice(0, -2));
        if (word.length > 3 && word.slice(-1) === 's' && word.slice(-2) !== 'ss') keys.push(word.slice(0, -1));
        if (word.length > 5 && word.slice(-3) === 'ing') {
            var b = word.slice(0, -3);
            keys.push(b);
            if (b.length >= 3 && b.slice(-1) !== 'e') keys.push(b + 'e');
            if (b.length > 3 && b.charAt(b.length - 1) === b.charAt(b.length - 2)) keys.push(b.slice(0, -1));
        }
        if (word.length > 4 && word.slice(-2) === 'ed') {
            var b2 = word.slice(0, -2);
            keys.push(b2);
            if (b2.slice(-1) !== 'e') keys.push(b2 + 'e');
        }
        if (word.length > 4 && word.slice(-2) === 'er') {
            var b3 = word.slice(0, -2);
            keys.push(b3);
            if (b3.slice(-1) !== 'e') keys.push(b3 + 'e');
        }
        var out = [];
        var i;
        for (i = 0; i < keys.length; i++) {
            if (keys[i] && keys[i].length >= 3) out.push(keys[i]);
        }
        if (!out.length && word) out.push(word);
        return unique(out);
    }

    function packWords(text) {
        var parts = normalize(text).split(' ');
        var out = [];
        var i;
        for (i = 0; i < parts.length; i++) {
            if (!parts[i]) continue;
            out.push({ raw: parts[i], keys: stemKeys(parts[i]) });
        }
        return out;
    }

    function sameFirst(a, b) {
        return a.charAt(0) === b.charAt(0);
    }

    /* One insertion, deletion, or adjacent transposition. */
    function editAtMost1(a, b) {
        if (a === b) return true;
        var la = a.length;
        var lb = b.length;
        if (Math.abs(la - lb) > 1) return false;
        if (!sameFirst(a, b)) return false;
        var i = 0;
        var j = 0;
        var edits = 0;
        var shorter = a;
        var longer = b;
        if (la > lb) { shorter = b; longer = a; }
        var ls = shorter.length;
        var ll = longer.length;
        while (i < ls && j < ll) {
            if (shorter.charAt(i) === longer.charAt(j)) { i++; j++; continue; }
            edits++;
            if (edits > 1) return false;
            if (ls === ll) {
                /* Adjacent transposition counts. A substituted letter does not,
                   so "store" stays off "story" while "bitcion" still hits "bitcoin". */
                if (i + 1 < ls && shorter.charAt(i) === longer.charAt(j + 1) && shorter.charAt(i + 1) === longer.charAt(j)) {
                    i += 2;
                    j += 2;
                    continue;
                }
                return false;
            }
            j++;
        }
        if (j < ll || i < ls) edits++;
        return edits <= 1;
    }

    function keysHit(qKeys, word) {
        var i, j;
        for (i = 0; i < qKeys.length; i++) {
            for (j = 0; j < word.keys.length; j++) {
                if (qKeys[i] === word.keys[j]) return true;
            }
        }
        return false;
    }

    function wordHit(token, word, fuzzy) {
        if (!token || !word) return false;
        if (token.raw === word.raw) return true;
        if (keysHit(token.keys, word)) return true;
        if (!fuzzy) return false;
        if (prefixHit(token.raw, word.raw)) return true;
        if (token.raw.length >= 5 && word.raw.length > token.raw.length && word.raw.slice(-token.raw.length) === token.raw) return true;
        if (token.raw.length >= 5 && word.raw.length >= 5 && sharedPrefix(token.raw, word.raw) >= 3 && Math.abs(token.raw.length - word.raw.length) <= 1 && editAtMost1(token.raw, word.raw)) return true;
        return false;
    }

    function anyHit(token, words, fuzzy) {
        var i;
        for (i = 0; i < words.length; i++) {
            if (wordHit(token, words[i], fuzzy)) return true;
        }
        return false;
    }

    function meaningful(rawTokens) {
        var kept = [];
        var i;
        for (i = 0; i < rawTokens.length; i++) {
            var t = rawTokens[i];
            if (!t || STOP[t]) continue;
            kept.push(t);
        }
        var out = [];
        for (i = 0; i < kept.length; i++) out.push({ raw: kept[i], keys: stemKeys(kept[i]) });
        return out;
    }

    function sharedPrefix(a, b) {
        var n = 0;
        var max = a.length < b.length ? a.length : b.length;
        while (n < max && a.charAt(n) === b.charAt(n)) n++;
        return n;
    }

    /* "store" must not match "stories". Prefixes of a plural-ies word use its stem. */
    function prefixHit(token, word) {
        if (!token || token.length < 2 || !word || word.indexOf(token) !== 0) return false;
        if (word === token) return true;
        if (word.length > 4 && word.slice(-3) === 'ies') {
            return (word.slice(0, -3) + 'y').indexOf(token) === 0;
        }
        return true;
    }

    function metaFor(id, index) {
        if (index.topics && index.topics[id]) return index.topics[id];
        if (index.extras && index.extras[id]) return index.extras[id];
        return {};
    }

    function prepare(topics, index) {
        index = index || {};
        var rows = [];
        var seen = {};
        var i;
        var list = topics || [];
        for (i = 0; i < list.length; i++) {
            var topic = list[i];
            if (!topic || !topic.id || seen[topic.id]) continue;
            seen[topic.id] = 1;
            rows.push(rowFrom(topic, metaFor(topic.id, index), i));
        }
        var extras = index.extras || {};
        var ids = Object.keys(extras);
        for (i = 0; i < ids.length; i++) {
            if (seen[ids[i]]) continue;
            var extra = extras[ids[i]];
            seen[ids[i]] = 1;
            rows.push(rowFrom({
                id: ids[i],
                title: extra.title || ids[i],
                desc: extra.desc || '',
                emoji: extra.emoji || '',
                extra: true
            }, extra, rows.length));
        }
        return rows;
    }

    function rowFrom(topic, meta, order) {
        var title = topic.title || topic.id;
        var titleNorm = normalize(title);
        var idNorm = normalize(topic.id);
        return {
            id: topic.id,
            order: order,
            titleNorm: titleNorm,
            idNorm: idNorm,
            titleWords: packWords(title + ' ' + (topic.id || '')),
            intentWords: packWords((meta.intent || []).join(' ')),
            contentWords: packWords(((meta.content || []).join(' ')) + ' ' + (topic.desc || '') + ' ' + (meta.desc || ''))
        };
    }

    function tokenRank(token, row) {
        if (anyHit(token, row.titleWords, true)) return 1;
        if (anyHit(token, row.intentWords, true)) return 2;
        if (anyHit(token, row.contentWords, false)) return 3;
        return 0;
    }

    function phraseIds(queryNorm, index) {
        var queries = (index && index.queries) || {};
        return queries[queryNorm] || null;
    }

    function search(query, topics, index) {
        index = index || {};
        var qNorm = normalize(query);
        var tokens = meaningful(qNorm ? qNorm.split(' ') : []);
        var rows = prepare(topics, index);
        var forced = {};
        var curatedAt = {};
        var listed = phraseIds(qNorm, index) || [];
        var f;
        for (f = 0; f < listed.length; f++) {
            forced[listed[f]] = 2;
            curatedAt[listed[f]] = f;
        }
        if (!tokens.length && !listed.length) return { query: qNorm, matches: [] };
        var matches = [];
        var i;
        for (i = 0; i < rows.length; i++) {
            var row = rows[i];
            var exact = !!(qNorm && (qNorm === row.titleNorm || qNorm === row.idNorm));
            var best = exact ? 0 : 99;
            var sum = exact ? 0 : 0;
            var ok = exact;
            var t;
            if (!exact && tokens.length) {
                ok = true;
                for (t = 0; t < tokens.length; t++) {
                    var rank = tokenRank(tokens[t], row);
                    if (!rank) { ok = false; break; }
                    if (rank < best) best = rank;
                    sum += rank;
                }
            }
            if (!ok && forced[row.id] != null) {
                ok = true;
                best = forced[row.id];
                sum = forced[row.id] * Math.max(tokens.length, 1);
            } else if (ok && forced[row.id] != null && forced[row.id] < best) {
                best = forced[row.id];
            }
            if (!ok) continue;
            matches.push({ id: row.id, rank: best, sum: sum, order: row.order });
        }
        matches.sort(function (a, b) {
            if (a.rank !== b.rank) return a.rank - b.rank;
            var aCur = curatedAt[a.id];
            var bCur = curatedAt[b.id];
            var aListed = aCur != null;
            var bListed = bCur != null;
            if (aListed !== bListed) return aListed ? -1 : 1;
            if (aListed && bListed && aCur !== bCur) return aCur - bCur;
            if (a.sum !== b.sum) return a.sum - b.sum;
            return a.order - b.order;
        });
        return { query: qNorm, matches: matches };
    }

    return {
        normalize: normalize,
        stemKeys: stemKeys,
        editAtMost1: editAtMost1,
        prepare: prepare,
        search: search
    };
});
