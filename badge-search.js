/* Badge search. Names, ids, descriptions, categories, and collection names.
   Normalization is accent-insensitive and treats _, -, and spaces as the same.
   Results are drawn with textContent. */
(function (root, factory) {
    var api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.BadgeSearch = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
    function normalize(value) {
        var s = String(value == null ? '' : value);
        if (typeof s.normalize === 'function') s = s.normalize('NFKD');
        s = s.replace(/\p{M}/gu, '');
        s = s.replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'");
        s = s.replace(/[\u201C\u201D\u201E\u2033]/g, '"');
        s = s.replace(/\uFE0F/g, '');
        s = s.toLowerCase();
        s = s.replace(/[_\-/]+/g, ' ');
        s = s.replace(/\s+/g, ' ').trim();
        return s;
    }

    function tokens(query) {
        var n = normalize(query);
        return n ? n.split(' ') : [];
    }

    function buildIndex(badges) {
        return (badges || []).map(function (badge) {
            var fields = {
                id: normalize(badge.id),
                name: normalize(badge.name),
                desc: normalize(badge.desc),
                emoji: normalize(badge.emoji),
                category: normalize(badge.category),
                collections: normalize((badge.collections || []).join(' ')),
            };
            return {
                badge: badge,
                fields: fields,
                blob: [fields.id, fields.name, fields.desc, fields.emoji, fields.category, fields.collections].join(' '),
            };
        });
    }

    function rankOf(row, queryNorm) {
        var name = row.fields.name;
        var id = row.fields.id;
        if (name && name === queryNorm) return 0;
        if (name && name.indexOf(queryNorm) === 0) return 1;
        var words = name ? name.split(' ') : [];
        for (var i = 0; i < words.length; i++) {
            if (words[i].indexOf(queryNorm) === 0) return 2;
        }
        if (id && (id === queryNorm || id.indexOf(queryNorm) !== -1)) return 3;
        if ((row.fields.category && row.fields.category.indexOf(queryNorm) !== -1) ||
            (row.fields.collections && row.fields.collections.indexOf(queryNorm) !== -1)) return 4;
        return 5;
    }

    function search(index, query, opts) {
        var toks = tokens(query);
        var options = opts || {};
        if (!toks.length) return { query: query || '', total: 0, shown: [], truncated: false };
        var qn = toks.join(' ');
        var hits = [];
        for (var i = 0; i < index.length; i++) {
            var row = index[i];
            var ok = true;
            for (var t = 0; t < toks.length; t++) {
                if (row.blob.indexOf(toks[t]) === -1) { ok = false; break; }
            }
            if (!ok) continue;
            if (row.badge.hidden && !row.badge.earned) continue;
            hits.push(row);
        }
        hits.sort(function (a, b) {
            var ra = rankOf(a, qn);
            var rb = rankOf(b, qn);
            if (ra !== rb) return ra - rb;
            var ae = a.badge.earned ? 1 : 0;
            var be = b.badge.earned ? 1 : 0;
            if (ae !== be) return ae - be;
            return (Number(b.badge.xp) || 0) - (Number(a.badge.xp) || 0);
        });
        var limit = options.showAll ? hits.length : Math.min(8, hits.length);
        return {
            query: query,
            total: hits.length,
            shown: hits.slice(0, limit).map(function (row) { return row.badge; }),
            truncated: hits.length > limit,
        };
    }

    function render(container, result) {
        var doc = container.ownerDocument || document;
        while (container.firstChild) container.removeChild(container.firstChild);
        var collections = result.collections || [];
        collections.forEach(function (col) {
            var row = doc.createElement('div');
            row.setAttribute('data-collection-progress', col.id || col.name || '');
            row.style.cssText = 'padding:10px 14px;border-top:1px solid var(--border);';
            var name = doc.createElement('div');
            name.style.cssText = 'font-size:0.82rem;font-weight:800;';
            name.textContent = (col.emoji ? col.emoji + ' ' : '') + (col.name || '');
            var prog = doc.createElement('div');
            prog.style.cssText = 'font-size:0.7rem;color:var(--text-muted);margin-top:2px;';
            prog.textContent = (Number(col.earned) || 0) + '/' + (Number(col.total) || 0) + ' · ' + (Number(col.pct) || 0) + '%';
            var track = doc.createElement('div');
            track.style.cssText = 'height:6px;border-radius:6px;background:var(--bg-side);overflow:hidden;margin-top:6px;';
            var fill = doc.createElement('div');
            fill.style.cssText = 'height:100%;border-radius:6px;background:' + (col.color || '#f7931a') + ';width:' + Math.max(0, Math.min(100, Number(col.pct) || 0)) + '%;';
            track.appendChild(fill);
            row.appendChild(name);
            row.appendChild(prog);
            row.appendChild(track);
            container.appendChild(row);
        });
        if (!result.total && !collections.length) {
            var empty = doc.createElement('div');
            empty.style.padding = '12px 14px';
            empty.style.color = 'var(--text-muted)';
            empty.textContent = 'No badges found for "' + String(result.query || '') + '"';
            container.appendChild(empty);
            container.style.display = 'block';
            return;
        }
        if (!result.total) {
            container.style.display = 'block';
            return;
        }
        var head = doc.createElement('div');
        head.style.cssText = 'padding:8px 14px;font-size:0.72rem;color:var(--text-faint);font-weight:700;';
        head.textContent = result.total + (result.total === 1 ? ' result' : ' results');
        container.appendChild(head);
        result.shown.forEach(function (badge, index) {
            var row = doc.createElement('button');
            row.type = 'button';
            row.setAttribute('data-badge-id', badge.id);
            row.setAttribute('data-badge-search-row', String(index));
            row.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:10px 14px;background:none;border:none;border-top:1px solid var(--border);cursor:pointer;font-family:inherit;color:inherit;';
            var emoji = doc.createElement('span');
            emoji.textContent = badge.earned ? (badge.emoji || '🏅') : '🔘';
            emoji.style.fontSize = '1.3rem';
            var body = doc.createElement('div');
            body.style.flex = '1';
            var name = doc.createElement('div');
            name.style.cssText = 'font-size:0.82rem;font-weight:700;';
            name.textContent = badge.name || badge.id;
            var desc = doc.createElement('div');
            desc.style.cssText = 'font-size:0.7rem;color:var(--text-muted);';
            desc.textContent = (badge.earned ? 'Earned. ' : '') + (badge.desc || '');
            body.appendChild(name);
            body.appendChild(desc);
            var xp = doc.createElement('span');
            xp.style.cssText = 'font-size:0.7rem;font-weight:700;color:#22c55e;';
            xp.textContent = '+' + (Number(badge.xp) || 0) + ' XP';
            row.appendChild(emoji);
            row.appendChild(body);
            row.appendChild(xp);
            container.appendChild(row);
        });
        if (result.truncated) {
            var more = doc.createElement('button');
            more.type = 'button';
            more.setAttribute('data-badge-search-more', '1');
            more.style.cssText = 'width:100%;padding:10px 14px;background:none;border:none;border-top:1px solid var(--border);color:var(--accent);font-weight:700;cursor:pointer;font-family:inherit;';
            more.textContent = 'Show all ' + result.total;
            container.appendChild(more);
        }
        container.style.display = 'block';
    }

    var active = -1;
    var lastQuery = '';
    var showAll = false;
    var timer = null;

    function paint(query) {
        var box = document.getElementById('badgeSearchResults');
        if (!box || !root.BadgeSearch || typeof root._badgeSearchRecords !== 'function') return;
        var index = buildIndex(root._badgeSearchRecords());
        var result = search(index, query, { showAll: showAll });
        var qn = normalize(query);
        result.collections = [];
        if (qn && typeof root._badgeCollectionProgress === 'function') {
            result.collections = root._badgeCollectionProgress().filter(function (col) {
                return normalize(col.name).indexOf(qn) !== -1;
            });
        }
        render(box, result);
        active = -1;
        if (!query) {
            box.style.display = 'none';
            while (box.firstChild) box.removeChild(box.firstChild);
        }
    }

    function move(delta) {
        var box = document.getElementById('badgeSearchResults');
        if (!box) return;
        var rows = box.querySelectorAll('[data-badge-search-row]');
        if (!rows.length) return;
        active = (active + delta + rows.length) % rows.length;
        for (var i = 0; i < rows.length; i++) rows[i].style.background = i === active ? 'rgba(247,147,26,0.12)' : '';
        if (rows[active] && rows[active].scrollIntoView) rows[active].scrollIntoView({ block: 'nearest' });
    }

    function install() {
        if (root._badgeSearchInstalled) return;
        root._badgeSearchInstalled = true;
        root._badgeSearch = function (query) {
            lastQuery = query || '';
            showAll = false;
            clearTimeout(timer);
            timer = setTimeout(function () { paint(lastQuery); }, 120);
        };
        document.addEventListener('click', function (event) {
            var box = document.getElementById('badgeSearchResults');
            if (!box || !event.target || !event.target.closest) return;
            if (!box.contains(event.target)) return;
            if (event.target.closest('[data-badge-search-more]')) {
                showAll = true;
                paint(lastQuery);
                return;
            }
            var row = event.target.closest('[data-badge-id]');
            if (row && typeof root._badgeSearchJump === 'function') root._badgeSearchJump(row.getAttribute('data-badge-id'));
        });
        document.addEventListener('keydown', function (event) {
            var input = document.getElementById('badgeSearchInput');
            if (!input || document.activeElement !== input) return;
            if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
            else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
            else if (event.key === 'Enter') {
                var box = document.getElementById('badgeSearchResults');
                var rows = box ? box.querySelectorAll('[data-badge-search-row]') : [];
                var pick = rows[active] || rows[0];
                if (pick && typeof root._badgeSearchJump === 'function') {
                    event.preventDefault();
                    root._badgeSearchJump(pick.getAttribute('data-badge-id'));
                }
            }
        });
    }

    return {
        normalize: normalize,
        tokens: tokens,
        buildIndex: buildIndex,
        search: search,
        render: render,
        install: install,
    };
});
