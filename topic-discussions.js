// Live community discussion under each educational topic.
// Legacy Discord replies (a later cleanup) mount in #community-discussion-archive
// [data-legacy="discord"]. Live posts render in #topic-discussion-live, in the
// same collapsible Community discussion section. Post text is textContent only.
(function() {
    var PAGE = 20;
    var REPLIES = 30;
    var MAX_PAGES = 5;

    function topicStickyScrollDelta(elTop, containerTop, stickyCover) {
        var visibleTop = Math.max(containerTop, stickyCover);
        return elTop - visibleTop - 8;
    }

    function el(tag, className) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        return node;
    }

    function btn(label, className, onClick) {
        var node = el('button', className || 'td-btn');
        node.type = 'button';
        node.textContent = label;
        node.addEventListener('click', onClick);
        return node;
    }

    function toast(message) {
        if (typeof showToast === 'function') showToast(message);
    }

    function viewer() {
        var user = (typeof auth !== 'undefined' && auth && auth.currentUser) ? auth.currentUser : null;
        if (!user || user.isAnonymous) {
            return { signedIn: false, guest: !!(user && user.isAnonymous), uid: '', name: '', admin: false };
        }
        var name = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? String(currentUser.username) : '';
        return {
            signedIn: true,
            guest: false,
            uid: user.uid,
            name: name,
            admin: window._isAdminClaim === true
        };
    }

    function millisFromTimestamp(ts) {
        if (ts == null || ts === '') return 0;
        if (typeof ts.toMillis === 'function') {
            try {
                var fromMillis = Number(ts.toMillis());
                if (fromMillis > 0 && isFinite(fromMillis)) return fromMillis;
            } catch (e) {}
        }
        if (typeof ts.toDate === 'function') {
            try {
                var date = ts.toDate();
                var fromDate = date && typeof date.getTime === 'function' ? date.getTime() : 0;
                if (fromDate > 0 && isFinite(fromDate)) return fromDate;
            } catch (e2) {}
        }
        if (typeof ts === 'object' && typeof ts.seconds === 'number') {
            var fromSeconds = ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1e6);
            if (fromSeconds > 0 && isFinite(fromSeconds)) return fromSeconds;
        }
        if (typeof ts === 'number' && isFinite(ts) && ts > 0) return ts;
        return 0;
    }

    // Server timestamp only: Firestore createdAt, then the server-written createdAtMs.
    function postInstant(post) {
        if (!post || typeof post !== 'object') return 0;
        var fromCreated = millisFromTimestamp(post.createdAt);
        if (fromCreated) return fromCreated;
        if (typeof post.createdAtMs === 'number' && isFinite(post.createdAtMs) && post.createdAtMs > 0) return post.createdAtMs;
        return 0;
    }

    function formatTopicPostTime(post) {
        var ms = postInstant(post);
        if (!ms) return { text: 'Just now', iso: '', pending: true };
        var date = new Date(ms);
        if (isNaN(date.getTime())) return { text: 'Just now', iso: '', pending: true };
        var datePart = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
        var timePart = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
        return { text: datePart + ' · ' + timePart, iso: date.toISOString(), pending: false };
    }

    window.bqFormatTopicPostTime = formatTopicPostTime;

    function postsCol(channelId) {
        return db.collection('topic_discussions').doc(channelId).collection('posts');
    }

    function callFn(name, payload) {
        return firebase.functions().httpsCallable(name)(payload);
    }

    function errorText(err, fallback) {
        var message = err && (err.message || (err.details && err.details.message));
        if (message && message.indexOf('internal') === -1 && message.length < 180) return message;
        return fallback;
    }

    function injectStyle() {
        if (document.getElementById('topic-discussion-style')) return;
        var style = el('style');
        style.id = 'topic-discussion-style';
        style.textContent = [
            '.td-section{margin:28px 16px 36px;border:1px solid var(--border,#1e293b);border-radius:16px;background:var(--card-bg,rgba(255,255,255,0.03));overflow:hidden;}',
            '.td-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;background:none;border:none;color:var(--heading,#fff);font-weight:800;font-size:1rem;cursor:pointer;font-family:inherit;text-align:left;}',
            '.td-toggle small{font-weight:600;color:var(--text-muted,#94a3b8);font-size:0.75rem;}',
            '.td-body{padding:0 16px 16px;}',
            '.td-body[hidden]{display:none;}',
            '.td-archive{margin-bottom:12px;}',
            '.td-live{display:flex;flex-direction:column;gap:10px;}',
            '.td-post{display:flex;gap:10px;padding:10px 12px;border:1px solid var(--border,#1e293b);border-radius:12px;background:rgba(0,0,0,0.15);}',
            '.td-post.td-reply{margin-left:28px;}',
            '.td-avatar{width:32px;height:32px;border-radius:50%;flex-shrink:0;object-fit:cover;background:#111;}',
            '.td-avatar-fallback{width:32px;height:32px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:#1e293b;color:#fdba74;font-weight:800;font-size:0.85rem;}',
            '.td-main{flex:1;min-width:0;}',
            '.td-meta{display:flex;flex-wrap:wrap;gap:6px;align-items:baseline;margin-bottom:4px;}',
            '.td-name{font-weight:800;font-size:0.82rem;color:var(--heading,#fff);}',
            '.td-name.td-nacho{color:#22c55e;}',
            '.td-time,.td-anchor{font-size:0.72rem;color:var(--text-faint,#64748b);white-space:nowrap;}',
            '.td-convo-btn{display:flex;align-items:center;width:fit-content;max-width:100%;box-sizing:border-box;margin:12px 0 16px;padding:8px 14px;min-height:40px;border-radius:999px;border:1px solid var(--accent,#f97316);background:rgba(249,115,22,0.08);color:var(--accent,#f97316);font-weight:800;font-size:0.82rem;line-height:1.2;font-family:inherit;cursor:pointer;white-space:normal;text-align:left;}',
            '.td-convo-btn:hover,.td-convo-btn:focus-visible{background:rgba(249,115,22,0.16);outline:2px solid var(--accent,#f97316);outline-offset:2px;}',
            '.td-text{font-size:0.92rem;line-height:1.45;color:var(--text,#e2e8f0);white-space:pre-wrap;word-break:break-word;}',
            '.td-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}',
            '.td-btn{padding:4px 8px;border-radius:8px;border:1px solid var(--border,#1e293b);background:none;color:var(--text-muted,#94a3b8);font-size:0.72rem;font-weight:700;cursor:pointer;font-family:inherit;}',
            '.td-compose{display:flex;flex-direction:column;gap:8px;margin-top:12px;}',
            '.td-compose textarea{width:100%;box-sizing:border-box;min-height:72px;max-height:180px;padding:12px;border-radius:12px;border:1px solid var(--border,#1e293b);background:var(--input-bg,#020617);color:var(--text,#e2e8f0);font-size:16px;font-family:inherit;resize:vertical;}',
            '.td-compose-row{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;}',
            '.td-send{padding:10px 16px;border:none;border-radius:10px;background:var(--accent,#f97316);color:#fff;font-weight:800;cursor:pointer;font-family:inherit;}',
            '.td-send:disabled{opacity:0.55;cursor:default;}',
            '.td-note{font-size:0.75rem;color:var(--text-muted,#94a3b8);line-height:1.4;}',
            '.td-forum-notice{margin:0;padding:8px 10px;border-radius:10px;border:1px solid rgba(249,115,22,0.45);background:rgba(249,115,22,0.1);color:var(--text,#e2e8f0);font-size:0.82rem;font-weight:700;line-height:1.35;}',
            '.td-fallback{padding:10px 12px;border-radius:10px;background:rgba(249,115,22,0.08);color:var(--text-muted,#94a3b8);font-size:0.85rem;margin-bottom:10px;}',
            '.td-replies{display:flex;flex-direction:column;gap:8px;margin-top:8px;}',
            '.td-inline{margin:8px 0 16px;padding:10px 10px 12px;border:1px solid rgba(249,115,22,0.55);border-radius:14px;background:rgba(2,6,23,0.72);}',
            '.td-inline-title{font-weight:800;font-size:0.72rem;letter-spacing:0.06em;text-transform:uppercase;color:var(--accent,#f97316);margin:0 0 8px;}',
            '.td-anchor-note{margin:0;}',
            '.topic-anchor-flash{border-radius:6px;box-decoration-break:clone;-webkit-box-decoration-break:clone;}',
            '.topic-post-highlight{animation:topicPostFlash 2.6s ease forwards;border-color:#f97316 !important;}',
            '@keyframes topicPostFlash{0%,45%{box-shadow:0 0 0 3px rgba(249,115,22,0.9);background:rgba(249,115,22,0.22);}100%{box-shadow:0 0 0 0 rgba(249,115,22,0);background:transparent;}}',
            '@media (max-width:420px){.td-section{margin:20px 10px 28px;}.td-post.td-reply{margin-left:12px;}.td-body{padding:0 10px 12px;}.td-convo-btn{margin:10px 0 14px;padding:10px 12px;min-height:44px;font-size:0.8rem;}}'
        ].join('');
        document.head.appendChild(style);
    }

    function avatarFor(post) {
        if (post && post.isNacho) {
            var img = el('img', 'td-avatar');
            img.src = 'nacho-deer.svg';
            img.alt = '';
            img.width = 32;
            img.height = 32;
            return img;
        }
        var fallback = el('div', 'td-avatar-fallback');
        var name = post && post.name ? String(post.name) : '?';
        fallback.textContent = name.trim().charAt(0).toUpperCase() || '?';
        return fallback;
    }

    function renderPost(post, ctx) {
        var who = ctx.viewer || viewer();
        var row = el('article', 'td-post' + (post.parentId ? ' td-reply' : ''));
        row.id = 'td-post-' + post.id;
        row.setAttribute('data-post-id', post.id);
        row.appendChild(avatarFor(post));
        var main = el('div', 'td-main');
        var meta = el('div', 'td-meta');
        var name = el('span', 'td-name' + (post.isNacho ? ' td-nacho' : ''));
        name.textContent = post.isNacho ? 'Nacho' : (post.name || 'Member');
        meta.appendChild(name);
        var when = formatTopicPostTime(post);
        if (when.pending) state.sawPending = true;
        var time = el('time', 'td-time');
        time.textContent = when.text;
        if (when.iso) time.setAttribute('datetime', when.iso);
        time.setAttribute('title', when.text);
        if (when.pending) time.setAttribute('data-pending', '1');
        meta.appendChild(time);
        if (post.hidden) {
            var hidden = el('span', 'td-anchor');
            hidden.textContent = 'Hidden';
            meta.appendChild(hidden);
        }
        if (who.admin && post.reportCount) {
            var reports = el('span', 'td-anchor');
            reports.textContent = 'Reports ' + post.reportCount;
            meta.appendChild(reports);
        }
        main.appendChild(meta);
        var text = el('div', 'td-text');
        if (post.deleted) text.textContent = 'Comment removed';
        else if (post.hidden && !who.admin) text.textContent = '';
        else text.textContent = post.text || '';
        main.appendChild(text);
        var actions = el('div', 'td-actions');
        if (!post.deleted && !post.parentId && who.signedIn) {
            actions.appendChild(btn('Reply', 'td-btn', function() { ctx.onReply(post); }));
        }
        if (!post.deleted && who.signedIn && who.uid && who.uid !== post.uid) {
            actions.appendChild(btn('Report', 'td-btn', function() { ctx.onReport(post); }));
        }
        if (!post.deleted && who.uid && who.uid === post.uid && !post.isNacho) {
            actions.appendChild(btn('Delete', 'td-btn', function() { ctx.onDelete(post); }));
        }
        if (who.admin && !post.deleted) {
            if (post.hidden) actions.appendChild(btn('Unhide', 'td-btn', function() { ctx.onModerate(post, 'unhide'); }));
            else actions.appendChild(btn('Hide', 'td-btn', function() { ctx.onModerate(post, 'hide'); }));
            actions.appendChild(btn('Remove', 'td-btn', function() { ctx.onModerate(post, 'delete'); }));
        }
        if (!post.parentId && !post.deleted) {
            actions.appendChild(btn(post._open ? 'Hide replies' : 'Replies', 'td-btn', function() { ctx.onToggleReplies(post); }));
        }
        if (actions.childNodes.length) main.appendChild(actions);
        if (post._replies && post._replies.length) {
            var thread = el('div', 'td-replies');
            post._replies.forEach(function(reply) {
                thread.appendChild(renderPost(reply, ctx));
            });
            main.appendChild(thread);
        }
        row.appendChild(main);
        return row;
    }

    window._topicDiscussionRenderPost = renderPost;

    function stickyCoverPx() {
        var bar = document.querySelector('.mobile-bar');
        if (!bar || !window.getComputedStyle) return 0;
        var cs = window.getComputedStyle(bar);
        if (cs.display === 'none' || cs.position !== 'fixed') return 0;
        return bar.getBoundingClientRect().height || 0;
    }

    function scrollPostIntoView(node) {
        if (!node || !node.getBoundingClientRect) return;
        var rect = node.getBoundingClientRect();
        var cover = stickyCoverPx();
        var main = document.getElementById('main');
        if (main && typeof main.scrollTo === 'function') {
            var delta = topicStickyScrollDelta(rect.top, main.getBoundingClientRect().top, cover);
            main.scrollTo({ top: Math.max(0, main.scrollTop + delta), behavior: 'smooth' });
        } else {
            var deltaWin = topicStickyScrollDelta(rect.top, 0, cover);
            window.scrollTo({ top: Math.max(0, window.scrollY + deltaWin), behavior: 'smooth' });
        }
        node.classList.add('topic-post-highlight');
        setTimeout(function() { node.classList.remove('topic-post-highlight'); }, 2800);
    }

    function visiblePost(post, who) {
        if (!post) return false;
        if (post.deleted && !(post.replyCount > 0)) return false;
        if (post.hidden && !(who && who.admin)) return false;
        return true;
    }

    var state = {
        channelId: '',
        unsub: null,
        replyUnsubs: {},
        posts: [],
        cursor: null,
        pages: 1,
        parentId: '',
        replyName: '',
        pendingTimer: null,
        pendingTries: 0,
        sawPending: false,
        pendingAnchor: null
    };

    var ANCHOR_INDEX_MAX = 8000;

    function normalizeAnchorSample(text) {
        return String(text || '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/&[#a-z0-9]+;/gi, ' ')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 80);
    }

    function anchorFingerprint(text) {
        var sample = normalizeAnchorSample(text);
        if (!sample) return '';
        var h = 2166136261;
        var i;
        for (i = 0; i < sample.length; i++) {
            h ^= sample.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        h >>>= 0;
        var out = h.toString(36);
        while (out.length < 8) out = '0' + out;
        return out.slice(-8);
    }

    function acceptClientAnchor(index, hash) {
        if (index == null || index === '' || hash == null || hash === '') return null;
        if (typeof index === 'boolean' || typeof index === 'object') return null;
        if (typeof index === 'string' && !/^(0|[1-9]\d*)$/.test(index)) return null;
        var n = typeof index === 'number' ? index : Number(index);
        if (!isFinite(n) || Math.floor(n) !== n || n < 0 || n > ANCHOR_INDEX_MAX) return null;
        if (typeof hash !== 'string' || !/^[a-z0-9]{8}$/.test(hash)) return null;
        return { index: n, hash: hash };
    }

    function clearPendingAnchor() {
        state.pendingAnchor = null;
        window._topicAnchorIndex = null;
        window._topicAnchorHash = '';
    }

    function rememberAnchor(index, text) {
        var accepted = acceptClientAnchor(index, anchorFingerprint(text));
        state.pendingAnchor = accepted;
        window._topicAnchorIndex = accepted ? accepted.index : null;
        window._topicAnchorHash = accepted ? accepted.hash : '';
        return accepted;
    }

    window.bqAnchorFingerprint = anchorFingerprint;
    window.bqAcceptTopicAnchor = acceptClientAnchor;

    function setOpen(open) {
        var body = document.getElementById('topic-discussion-body');
        var toggle = document.getElementById('community-discussion-toggle');
        if (!body || !toggle) return;
        body.hidden = !open;
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        try { sessionStorage.setItem('td_open_' + state.channelId, open ? '1' : '0'); } catch (e) {}
    }

    function showFallback(message) {
        var body = document.getElementById('topic-discussion-body');
        if (!body) return;
        setOpen(true);
        var note = document.getElementById('topic-discussion-fallback');
        if (!note) {
            note = el('div', 'td-fallback');
            note.id = 'topic-discussion-fallback';
            body.insertBefore(note, body.firstChild);
        }
        note.textContent = message || 'That comment was removed.';
    }

    function schedulePendingRefresh() {
        if (state.pendingTimer || state.pendingTries >= 5) return;
        state.pendingTries += 1;
        state.pendingTimer = setTimeout(function() {
            state.pendingTimer = null;
            paint();
        }, 1000);
    }

    function paint() {
        var live = document.getElementById('topic-discussion-live');
        var count = document.getElementById('topic-discussion-count');
        if (!live) return;
        state.sawPending = false;
        var who = viewer();
        var shown = state.posts.filter(function(post) { return visiblePost(post, who); });
        if (count) count.textContent = shown.length ? String(shown.length) : '';
        while (live.firstChild) live.removeChild(live.firstChild);
        if (!shown.length) {
            var empty = el('div', 'td-note');
            empty.textContent = 'No comments yet. Ask a question about this topic.';
            live.appendChild(empty);
        }
        var ctx = {
            viewer: who,
            onReply: function(post) {
                state.parentId = post.id;
                state.replyName = post.name || 'this comment';
                renderComposer();
                setOpen(true);
                var area = document.getElementById('topic-discussion-input');
                if (area) area.focus();
            },
            onReport: function(post) {
                if (!confirm('Report this comment to the moderators?')) return;
                callFn('reportTopicComment', { channelId: state.channelId, postId: post.id }).then(function() {
                    toast('Reported. Thank you.');
                }).catch(function(err) { toast(errorText(err, 'Could not report that comment.')); });
            },
            onDelete: function(post) {
                if (!confirm('Delete your comment?')) return;
                callFn('deleteTopicComment', { channelId: state.channelId, postId: post.id }).then(function() {
                    toast('Comment deleted.');
                }).catch(function(err) { toast(errorText(err, 'Could not delete that comment.')); });
            },
            onModerate: function(post, action) {
                var label = action === 'delete' ? 'Remove this comment?' : (action === 'hide' ? 'Hide this comment?' : 'Unhide this comment?');
                if (!confirm(label)) return;
                callFn('moderateTopicPost', { channelId: state.channelId, postId: post.id, action: action }).then(function() {
                    toast('Updated.');
                }).catch(function(err) { toast(errorText(err, 'Could not update that comment.')); });
            },
            onToggleReplies: function(post) {
                post._open = !post._open;
                if (!post._open) {
                    if (state.replyUnsubs[post.id]) { state.replyUnsubs[post.id](); delete state.replyUnsubs[post.id]; }
                    post._replies = [];
                    paint();
                    return;
                }
                watchReplies(post.id);
            }
        };
        shown.forEach(function(post) { live.appendChild(renderPost(post, ctx)); });
        var more = document.getElementById('topic-discussion-more');
        if (more) more.hidden = state.pages >= MAX_PAGES || !state.cursor;
        if (state.sawPending) schedulePendingRefresh();
        else state.pendingTries = 0;
        paintInline();
    }

    function upsert(list, post) {
        var next = list.filter(function(item) { return item.id !== post.id; });
        next.push(post);
        next.sort(function(a, b) {
            var am = a.createdAtMs || 0;
            var bm = b.createdAtMs || 0;
            return bm - am;
        });
        return next;
    }

    function fromDoc(doc) {
        var data = doc.data() || {};
        data.id = doc.id;
        if (!data.createdAtMs && data.createdAt && typeof data.createdAt.toMillis === 'function') {
            data.createdAtMs = data.createdAt.toMillis();
        }
        return data;
    }

    function watchTop() {
        if (state.unsub) { state.unsub(); state.unsub = null; }
        if (typeof db === 'undefined' || !db) return;
        state.unsub = postsCol(state.channelId)
            .where('parentId', '==', '')
            .orderBy('createdAt', 'desc')
            .limit(PAGE)
            .onSnapshot(function(snap) {
                var incoming = [];
                snap.forEach(function(doc) { incoming.push(fromDoc(doc)); });
                var prev = {};
                state.posts.forEach(function(post) { prev[post.id] = post; });
                incoming.forEach(function(post) {
                    var old = prev[post.id];
                    if (!old) return;
                    if (old._open) post._open = true;
                    if (old._replies) post._replies = old._replies;
                });
                var older = state.posts.filter(function(post) {
                    return !incoming.some(function(item) { return item.id === post.id; }) && post._paged;
                });
                state.posts = incoming.concat(older);
                if (snap.docs && snap.docs.length) state.cursor = snap.docs[snap.docs.length - 1];
                paint();
                focusPending();
            }, function() {
                var live = document.getElementById('topic-discussion-live');
                if (live) {
                    while (live.firstChild) live.removeChild(live.firstChild);
                    var note = el('div', 'td-note');
                    note.textContent = 'Discussion is unavailable right now.';
                    live.appendChild(note);
                }
            });
    }

    function watchReplies(parentId) {
        if (typeof db === 'undefined' || !db) return;
        if (state.replyUnsubs[parentId]) return;
        var keys = Object.keys(state.replyUnsubs);
        if (keys.length >= 3) {
            state.replyUnsubs[keys[0]]();
            delete state.replyUnsubs[keys[0]];
        }
        state.replyUnsubs[parentId] = postsCol(state.channelId)
            .where('parentId', '==', parentId)
            .orderBy('createdAt', 'asc')
            .limit(REPLIES)
            .onSnapshot(function(snap) {
                var replies = [];
                snap.forEach(function(doc) { replies.push(fromDoc(doc)); });
                state.posts.forEach(function(post) {
                    if (post.id === parentId) {
                        post._open = true;
                        post._replies = replies;
                    }
                });
                paint();
                focusPending();
            }, function() {});
    }

    function loadEarlier() {
        if (!state.cursor || state.pages >= MAX_PAGES || typeof db === 'undefined') return;
        postsCol(state.channelId)
            .where('parentId', '==', '')
            .orderBy('createdAt', 'desc')
            .startAfter(state.cursor)
            .limit(PAGE)
            .get()
            .then(function(snap) {
                state.pages += 1;
                var last = null;
                snap.forEach(function(doc) {
                    var post = fromDoc(doc);
                    post._paged = true;
                    state.posts = upsert(state.posts, post);
                    last = doc;
                });
                if (last) state.cursor = last;
                else state.cursor = null;
                paint();
            })
            .catch(function() { toast('Could not load earlier comments.'); });
    }

    function showCrossPostNote(text) {
        var body = document.getElementById('topic-discussion-body');
        if (!body) return;
        var notice = document.getElementById('td-forum-crosspost-notice');
        var note = document.getElementById('td-crosspost-note');
        if (!text) {
            if (note && note !== notice && note.parentNode) note.parentNode.removeChild(note);
            return;
        }
        var target = notice || note;
        if (!target) {
            target = el('p', 'td-forum-notice');
            var composer = document.getElementById('topic-discussion-composer');
            if (composer && composer.parentNode === body) body.insertBefore(target, composer);
            else body.appendChild(target);
        }
        target.id = 'td-crosspost-note';
        target.textContent = text;
    }
    window.bqShowCrossPostNote = showCrossPostNote;

    function forumCrossPostNotice() {
        var notice = el('p', 'td-forum-notice');
        notice.id = 'td-forum-crosspost-notice';
        notice.textContent = 'Your message will also be posted publicly to the Pleb Talk forum.';
        return notice;
    }

    function renderComposer() {
        var host = document.getElementById('topic-discussion-composer');
        if (!host) return;
        var who = viewer();
        while (host.firstChild) host.removeChild(host.firstChild);
        if (!who.signedIn) {
            var note = el('p', 'td-note');
            note.textContent = who.guest
                ? 'You are browsing as a guest. Create an account to ask a question. You can still read the discussion.'
                : 'Sign in to ask a question or leave a comment. Anyone can read.';
            host.appendChild(note);
            host.appendChild(forumCrossPostNotice());
            host.appendChild(btn('Sign in', 'td-send', function() {
                if (typeof showUsernamePrompt === 'function') showUsernamePrompt();
            }));
            return;
        }
        if (state.pendingAnchor && who.signedIn && !state.parentId) {
            var where = el('p', 'td-note td-anchor-note');
            where.textContent = 'This conversation is tied to the paragraph you picked.';
            var clearAnchor = btn('Bottom instead', 'td-btn', function() {
                clearPendingAnchor();
                renderComposer();
            });
            var anchorRow = el('div', 'td-compose-row');
            anchorRow.appendChild(where);
            anchorRow.appendChild(clearAnchor);
            host.appendChild(anchorRow);
        }
        if (state.parentId) {
            var banner = el('div', 'td-note');
            banner.textContent = 'Replying to ' + (state.replyName || 'this comment');
            var cancel = btn('Cancel', 'td-btn', function() {
                state.parentId = '';
                state.replyName = '';
                renderComposer();
            });
            var row = el('div', 'td-compose-row');
            row.appendChild(banner);
            row.appendChild(cancel);
            host.appendChild(row);
        }
        var area = el('textarea');
        area.id = 'topic-discussion-input';
        area.maxLength = 500;
        area.placeholder = 'Ask a question or leave a comment';
        area.setAttribute('aria-label', 'Comment on this topic');
        var count = el('span', 'td-note');
        count.textContent = '0/500';
        area.addEventListener('input', function() { count.textContent = String(area.value.length) + '/500'; });
        host.appendChild(area);
        host.appendChild(forumCrossPostNotice());
        var controls = el('div', 'td-compose-row');
        var hint = el('span', 'td-note');
        hint.textContent = 'Nacho may answer questions. A new conversation can earn XP.';
        var send = btn('Post', 'td-send', function() { submit(area, send); });
        controls.appendChild(hint);
        controls.appendChild(count);
        controls.appendChild(send);
        host.appendChild(controls);
    }

    function submit(area, send, opts) {
        var text = area.value.trim();
        if (!text) { toast('Write a comment first.'); return; }
        var who = viewer();
        if (!who.signedIn) { toast('Sign in to join the discussion.'); return; }
        if (!who.name || who.name.length < 2) { toast('Set a username first.'); return; }
        send.disabled = true;
        var payload = { channelId: state.channelId, text: text };
        var parentForPost = opts && opts.parentId ? opts.parentId : state.parentId;
        if (parentForPost) payload.parentId = parentForPost;
        if (!payload.parentId && state.pendingAnchor) {
            payload.anchorIndex = state.pendingAnchor.index;
            payload.anchorHash = state.pendingAnchor.hash;
        }
        callFn('postTopicComment', payload).then(function(res) {
            var data = res && res.data ? res.data : (res || {});
            if (data && data.toast) toast(data.toast);
            var crossNote = data && data.crossPostNote ? String(data.crossPostNote) : '';
            area.value = '';
            state.parentId = '';
            state.replyName = '';
            if (!payload.parentId) clearPendingAnchor();
            renderComposer();
            renderInlineComposer();
            showCrossPostNote(crossNote);
            if (crossNote) toast(crossNote);
            setOpen(true);
        }).catch(function(err) {
            toast(errorText(err, 'Could not post that comment.'));
        }).then(function() { send.disabled = false; });
    }

    function ensurePost(postId) {
        var who = viewer();
        var found = null;
        state.posts.forEach(function(post) {
            if (post.id === postId) found = post;
            (post._replies || []).forEach(function(reply) { if (reply.id === postId) found = reply; });
        });
        if (found) {
            if (!visiblePost(found, who) && found.deleted) return Promise.resolve('removed');
            if (found.parentId) watchReplies(found.parentId);
            return Promise.resolve('ok');
        }
        return postsCol(state.channelId).doc(postId).get().then(function(snap) {
            if (!snap.exists) return 'removed';
            var post = fromDoc(snap);
            if (post.deleted || (post.hidden && !who.admin)) return 'removed';
            if (post.parentId) {
                watchReplies(post.parentId);
                return 'ok';
            }
            post._paged = true;
            state.posts = upsert(state.posts, post);
            paint();
            return 'ok';
        }).catch(function() { return 'removed'; });
    }

    function topicLocationHash(channelId, postId, anchor) {
        var hash = '#topic=' + channelId + '&post=' + postId;
        if (anchor && acceptClientAnchor(anchor.index, anchor.hash)) {
            hash += '&i=' + anchor.index + '&h=' + anchor.hash;
        }
        return hash;
    }

    function replaceTopicHash(channelId, postId, anchor) {
        try {
            history.replaceState({ channel: channelId, topicPost: postId }, '', topicLocationHash(channelId, postId, anchor));
        } catch (e) {}
    }

    function postById(postId) {
        var found = null;
        state.posts.forEach(function(post) {
            if (post.id === postId) found = post;
            (post._replies || []).forEach(function(reply) {
                if (reply.id === postId) found = reply;
            });
        });
        return found;
    }

    function shouldFocusReply() {
        try {
            if (typeof navigator !== 'undefined' && navigator.userAgent && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) return false;
            if (window.matchMedia && window.matchMedia('(max-width: 800px)').matches) return false;
        } catch (e) {}
        return true;
    }

    function inlineHandlers(rootPost) {
        return {
            viewer: viewer(),
            onReply: function() {
                var area = document.getElementById('td-inline-input');
                if (area && shouldFocusReply()) area.focus();
            },
            onReport: function(post) {
                if (!confirm('Report this comment to the moderators?')) return;
                callFn('reportTopicComment', { channelId: state.channelId, postId: post.id }).then(function() {
                    toast('Reported. Thank you.');
                }).catch(function(err) { toast(errorText(err, 'Could not report that comment.')); });
            },
            onDelete: function(post) {
                if (!confirm('Delete your comment?')) return;
                callFn('deleteTopicComment', { channelId: state.channelId, postId: post.id }).then(function() {
                    toast('Comment deleted.');
                }).catch(function(err) { toast(errorText(err, 'Could not delete that comment.')); });
            },
            onModerate: function(post, action) {
                var label = action === 'delete' ? 'Remove this comment?' : (action === 'hide' ? 'Hide this comment?' : 'Unhide this comment?');
                if (!confirm(label)) return;
                callFn('moderateTopicPost', { channelId: state.channelId, postId: post.id, action: action }).then(function() {
                    toast('Updated.');
                }).catch(function(err) { toast(errorText(err, 'Could not update that comment.')); });
            },
            onToggleReplies: function(post) {
                post._open = !post._open;
                if (!post._open) {
                    if (state.replyUnsubs[post.id]) { state.replyUnsubs[post.id](); delete state.replyUnsubs[post.id]; }
                    post._replies = [];
                    paintInline();
                    return;
                }
                watchReplies(post.id);
            },
            rootId: rootPost && rootPost.id
        };
    }

    function paintInline() {
        var card = document.getElementById('td-inline-thread');
        if (!card) return;
        var post = postById(card.getAttribute('data-post-id'));
        var live = document.getElementById('td-inline-live');
        if (!live || !post || post.parentId) return;
        while (live.firstChild) live.removeChild(live.firstChild);
        post._open = true;
        live.appendChild(renderPost(post, inlineHandlers(post)));
    }

    function renderInlineComposer() {
        var host = document.getElementById('td-inline-composer');
        var card = document.getElementById('td-inline-thread');
        if (!host || !card) return;
        var rootId = card.getAttribute('data-post-id');
        var who = viewer();
        while (host.firstChild) host.removeChild(host.firstChild);
        if (!who.signedIn) {
            var note = el('p', 'td-note');
            note.textContent = who.guest
                ? 'You are browsing as a guest. Create an account to reply. You can still read the conversation.'
                : 'Sign in to reply in this conversation.';
            host.appendChild(note);
            host.appendChild(btn('Sign in', 'td-send', function() {
                if (typeof showUsernamePrompt === 'function') showUsernamePrompt();
            }));
            return;
        }
        var area = el('textarea');
        area.id = 'td-inline-input';
        area.maxLength = 500;
        area.placeholder = 'Write a reply...';
        area.setAttribute('aria-label', 'Reply in this conversation');
        var count = el('span', 'td-note');
        count.textContent = '0/500';
        area.addEventListener('input', function() { count.textContent = String(area.value.length) + '/500'; });
        host.appendChild(area);
        var controls = el('div', 'td-compose-row');
        var hint = el('span', 'td-note');
        hint.textContent = 'Replies stay in this conversation.';
        var send = btn('Reply', 'td-send', function() { submit(area, send, { parentId: rootId, inline: true }); });
        controls.appendChild(hint);
        controls.appendChild(count);
        controls.appendChild(send);
        host.appendChild(controls);
    }

    function elementForBlock(block) {
        var end = block && block.end;
        var node = end && (end.after || end.node);
        if (!node) return null;
        if (node.nodeType === 1) return node;
        return node.parentNode || null;
    }

    function placeInlineCard(block, card) {
        var endNode = block && block.end && (block.end.after || block.end.node);
        if (!endNode || !endNode.parentNode) return false;
        var next = endNode.nextSibling;
        while (next && next.nodeType === 3 && !/\S/.test(next.nodeValue || '')) next = next.nextSibling;
        if (next && next.classList && next.classList.contains('td-convo-btn')) {
            if (next.nextSibling) next.parentNode.insertBefore(card, next.nextSibling);
            else next.parentNode.appendChild(card);
            return true;
        }
        insertPromptAt(block.end, card);
        return !!card.parentNode;
    }

    function showInlineThread(block, post) {
        var old = document.getElementById('td-inline-thread');
        if (old && old.parentNode) old.parentNode.removeChild(old);
        if (!post || post.deleted || post.parentId) return false;
        post._open = true;
        var card = el('section', 'td-inline');
        card.id = 'td-inline-thread';
        card.setAttribute('data-post-id', post.id);
        var title = el('div', 'td-inline-title');
        title.textContent = 'Conversation';
        card.appendChild(title);
        var live = el('div', 'td-live');
        live.id = 'td-inline-live';
        card.appendChild(live);
        var composer = el('div', 'td-compose');
        composer.id = 'td-inline-composer';
        card.appendChild(composer);
        clearParagraphFlash();
        if (!placeInlineCard(block, card)) return false;
        paintInline();
        renderInlineComposer();
        watchReplies(post.id);
        scrollPostIntoView(highlightParagraph(block) || card);
        if (shouldFocusReply()) {
            setTimeout(function() {
                var area = document.getElementById('td-inline-input');
                if (area && typeof area.focus === 'function') area.focus();
            }, 60);
        }
        return true;
    }

    function finishAtBottom(link, anchor) {
        setOpen(true);
        var node = document.getElementById('td-post-' + link.postId);
        if (!node && link.rootId) node = document.getElementById('td-post-' + link.rootId);
        if (!node) return false;
        link.done = true;
        scrollPostIntoView(node);
        replaceTopicHash(link.channelId, link.rootId || link.postId, anchor || null);
        return true;
    }

    function focusPending() {
        var link = window._topicDeepLink;
        if (!link || link.done || link.channelId !== state.channelId) return;
        if (link.working) return;
        link.working = true;
        ensurePost(link.postId).then(function(result) {
            if (!window._topicDeepLink || window._topicDeepLink.postId !== link.postId) return;
            if (result === 'removed') {
                window._topicDeepLink.done = true;
                setOpen(true);
                showFallback('That comment was removed.');
                return;
            }
            var target = postById(link.postId);
            var rootId = target && target.parentId ? target.parentId : link.postId;
            link.rootId = rootId;
            if (rootId !== link.postId) return ensurePost(rootId);
            return 'ok';
        }).then(function() {
            if (!window._topicDeepLink || window._topicDeepLink.done || window._topicDeepLink.postId !== link.postId) return;
            var root = postById(link.rootId || link.postId);
            var anchor = root ? acceptClientAnchor(root.anchorIndex, root.anchorHash) : null;
            if (!anchor) {
                finishAtBottom(link, null);
                return;
            }
            whenTopicRendered(function() {
                if (!window._topicDeepLink || window._topicDeepLink.done || window._topicDeepLink.postId !== link.postId) return;
                var found = revealAnchorBlock(anchor);
                var current = postById(link.rootId || link.postId);
                if (!found || !current || !showInlineThread(found.block, current)) {
                    finishAtBottom(link, null);
                    return;
                }
                link.done = true;
                replaceTopicHash(link.channelId, current.id, anchor);
            });
        }).then(function() {
            if (link) link.working = false;
        }, function() {
            if (link) link.working = false;
        });
    }

    window._topicDiscussionFocus = focusPending;

    function isListLine(line) {
        return /^([-*•]|\d+[.)])\s+\S/.test(line);
    }
    function isQuoteLine(line) {
        return /^>/.test(line);
    }
    function isTableLine(line) {
        return /^\|.+\|$/.test(line);
    }
    function isEmbedOnly(text) {
        return /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?|youtu\.be\/|twitter\.com\/|x\.com\/)\S+$/i.test(String(text || '').trim());
    }
    function classifyBlock(text) {
        var raw = String(text || '').split('\n');
        var lines = [];
        var rawLines = [];
        raw.forEach(function(line) {
            if (!line.trim()) return;
            lines.push(line.trim());
            rawLines.push(line);
        });
        if (!lines.length) return 'empty';
        if (lines.every(isListLine)) return 'list';
        if (lines.every(isQuoteLine)) return 'quote';
        if (lines.every(isTableLine)) return 'table';
        if (rawLines.every(function(line) { return /^ {4}\S/.test(line) || /^```/.test(line.trim()); })) return 'code';
        if (lines.length === 1 && isEmbedOnly(lines[0])) return 'embed';
        return 'prose';
    }
    function isContentKind(kind) {
        return kind === 'prose' || kind === 'list' || kind === 'quote' || kind === 'code' || kind === 'table';
    }
    function mergeStructural(blocks) {
        var out = [];
        blocks.forEach(function(block) {
            var prev = out[out.length - 1];
            if (prev && prev.kind === block.kind && (block.kind === 'list' || block.kind === 'quote' || block.kind === 'table' || block.kind === 'code')) {
                prev.end = block.end || prev.end;
                prev.text = prev.text ? (prev.text + '\n' + (block.text || '')) : (block.text || '');
                return;
            }
            out.push(block);
        });
        return out;
    }
    function blankLength(value, index) {
        var rest = value.slice(index);
        var match = /^(?:\r\n|\n)[ \t]*(?:\r\n|\n)+/.exec(rest);
        return match ? match[0].length : 0;
    }
    function plainBlocks(text) {
        var value = String(text || '').replace(/<br\s*\/?>/gi, '\n');
        var blocks = [];
        var buf = '';
        var inCode = false;
        var i = 0;
        function flush(kind) {
            if (!/\S/.test(buf)) { buf = ''; return; }
            blocks.push({ kind: kind || (inCode ? 'code' : classifyBlock(buf)), text: buf.trim() });
            buf = '';
        }
        while (i < value.length) {
            if (!inCode && value.substr(i, 3) === '```') {
                flush();
                inCode = true;
                buf = '```';
                i += 3;
                continue;
            }
            if (inCode && value.substr(i, 3) === '```') {
                buf += '```';
                i += 3;
                flush('code');
                inCode = false;
                continue;
            }
            if (!inCode) {
                var blank = blankLength(value, i);
                if (blank) {
                    flush();
                    i += blank;
                    continue;
                }
            }
            buf += value.charAt(i);
            i += 1;
        }
        flush(inCode ? 'code' : '');
        return mergeStructural(blocks);
    }
    function contentParagraphsFromSource(html) {
        var source = String(html || '');
        source = source.replace(/<ul\b[^>]*>[\s\S]*?<\/ul>/gi, '\n\n- item\n');
        source = source.replace(/<ol\b[^>]*>[\s\S]*?<\/ol>/gi, '\n\n1. item\n');
        source = source.replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, '\n\n    code\n');
        source = source.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, '\n\n| a | b |\n');
        source = source.replace(/<blockquote\b[^>]*>[\s\S]*?<\/blockquote>/gi, '\n\n> quote\n');
        source = source.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '\n\nhttps://www.youtube.com/watch?v=pending\n');
        source = source.replace(/<[^>]+>/g, '');
        return plainBlocks(source).filter(function(block) { return isContentKind(block.kind); });
    }
    function planTopicConversationButtons(count, useful) {
        var slots = [];
        count = count | 0;
        if (count <= 0) return slots;
        if (count <= 4) {
            if (useful) slots.push(count - 1);
            return slots;
        }
        var at;
        for (at = 4; at <= count; at += 4) {
            if (count - at < 2) break;
            slots.push(at - 1);
        }
        if (!slots.length && count - 3 >= 2) slots.push(2);
        return slots;
    }
    window.bqPlanTopicConversationButtons = planTopicConversationButtons;

    function promptsUseful(paragraphs) {
        if (!paragraphs || paragraphs.length >= 2) return paragraphs && paragraphs.length >= 2;
        if (paragraphs.length === 1) {
            var letters = String(paragraphs[0].text || '').replace(/[^A-Za-z0-9]/g, '');
            return letters.length >= 40;
        }
        return false;
    }
    function topicTitle() {
        var title = '';
        var id = window.currentChannelId || '';
        try {
            if (typeof CHANNELS !== 'undefined' && CHANNELS && id && CHANNELS[id] && CHANNELS[id].title) {
                title = String(CHANNELS[id].title);
            }
        } catch (e) {}
        title = title.replace(/\s+/g, ' ').trim();
        return title || 'this topic';
    }
    function atomicKind(node) {
        if (!node || node.nodeType !== 1) return '';
        if (node.classList && node.classList.contains('td-inline')) return 'chrome';
        if (node.classList && (node.classList.contains('yt-embed') || node.classList.contains('tw-preview') || node.classList.contains('td-convo-btn'))) {
            return node.classList.contains('td-convo-btn') ? 'button' : 'embed';
        }
        var tag = node.tagName;
        if (tag === 'IFRAME') return 'embed';
        if (tag === 'UL' || tag === 'OL' || tag === 'LI') return 'list';
        if (tag === 'PRE') return 'code';
        if (tag === 'TABLE' || tag === 'THEAD' || tag === 'TBODY' || tag === 'TR' || tag === 'TD' || tag === 'TH') return 'table';
        if (tag === 'BLOCKQUOTE') return 'quote';
        return '';
    }
    function elementText(node) {
        var out = '';
        function walk(current) {
            if (!current || atomicKind(current) === 'button') return;
            if (current.nodeType === 3) { out += current.nodeValue || ''; return; }
            var child = current.firstChild;
            while (child) { walk(child); child = child.nextSibling; }
        }
        walk(node);
        return out;
    }
    function insideBlocked(node) {
        var el = node && node.parentNode;
        while (el) {
            if (el.classList && el.classList.contains('msg-text')) return false;
            var kind = atomicKind(el);
            if (kind === 'list' || kind === 'code' || kind === 'table' || kind === 'quote' || kind === 'embed') return true;
            el = el.parentNode;
        }
        return false;
    }
    function removePrompts(root) {
        var found = [];
        function walk(node) {
            if (!node) return;
            if (node.nodeType === 1 && node.classList && node.classList.contains('td-convo-btn')) found.push(node);
            var child = node.firstChild;
            while (child) {
                var next = child.nextSibling;
                walk(child);
                child = next;
            }
        }
        walk(root);
        found.forEach(function(node) {
            // tightenPromptGap strips the blank line after a button. Put it back
            // before the next parse so the following paragraph stays its own block.
            var next = node.nextSibling;
            if (next && next.nodeType === 3 && !/^(?:\r\n|\n)[ \t]*(?:\r\n|\n)/.test(String(next.nodeValue || ''))) {
                next.nodeValue = '\n\n' + String(next.nodeValue || '');
            }
            if (node.parentNode) node.parentNode.removeChild(node);
        });
    }
    function clearParagraphFlash(root) {
        var found = [];
        function walk(node) {
            if (!node) return;
            if (node.nodeType === 1 && node.classList && node.classList.contains('topic-anchor-flash')) found.push(node);
            var child = node.firstChild;
            while (child) {
                var next = child.nextSibling;
                walk(child);
                child = next;
            }
        }
        walk(root || document.getElementById('msgs') || document.body);
        found.forEach(function(span) {
            var parent = span.parentNode;
            if (!parent) return;
            while (span.firstChild) parent.insertBefore(span.firstChild, span);
            parent.removeChild(span);
        });
    }
    function highlightParagraph(block) {
        if (!block) return null;
        var start = block.start;
        var end = block.end;
        if (start && start.after && end && end.after && start.after.classList) {
            var marked = start.after;
            var step = marked;
            var guard = 0;
            while (step && guard < 40) {
                if (step.classList) step.classList.add('topic-post-highlight');
                if (step === end.after) break;
                step = step.nextSibling;
                guard += 1;
            }
            return marked;
        }
        var endNode = end && end.node;
        var startNode = start && start.node;
        if (!startNode || !endNode || startNode.nodeType !== 3 || !startNode.parentNode) return elementForBlock(block);
        if (endNode.nodeType === 3 && end.offset < String(endNode.nodeValue || '').length && typeof endNode.splitText === 'function') {
            endNode.splitText(end.offset);
        }
        if (start.offset > 0 && typeof startNode.splitText === 'function') {
            var right = startNode.splitText(start.offset);
            if (endNode === startNode) endNode = right;
            startNode = right;
        }
        if (!startNode || !startNode.parentNode) return elementForBlock(block);
        var span = document.createElement('span');
        span.className = 'topic-anchor-flash topic-post-highlight';
        startNode.parentNode.insertBefore(span, startNode);
        var node = startNode;
        var moved = 0;
        while (node && moved < 40) {
            var next = node.nextSibling;
            if (node === span) break;
            span.appendChild(node);
            moved += 1;
            if (node === endNode) break;
            node = next;
        }
        return span;
    }
    function paragraphsInElement(el) {
        var pieces = [];
        function walk(node) {
            if (!node) return;
            if (node.nodeType === 1) {
                var kind = atomicKind(node);
                if (kind) {
                    pieces.push({ type: 'atomic', kind: kind, node: node });
                    return;
                }
                var child = node.firstChild;
                while (child) { walk(child); child = child.nextSibling; }
                return;
            }
            if (node.nodeType === 3 && node.nodeValue) pieces.push({ type: 'text', node: node, value: node.nodeValue });
        }
        walk(el);
        var blocks = [];
        var buf = '';
        var endAt = null;
        var startAt = null;
        var inCode = false;
        function flush(kind) {
            if (!/\S/.test(buf)) { buf = ''; endAt = null; startAt = null; return; }
            blocks.push({ kind: kind || classifyBlock(buf), text: buf.trim(), end: endAt, start: startAt });
            buf = '';
            endAt = null;
            startAt = null;
        }
        pieces.forEach(function(piece) {
            if (piece.type === 'atomic') {
                flush();
                if (piece.kind === 'button' || piece.kind === 'chrome') return;
                blocks.push({ kind: piece.kind, text: elementText(piece.node).trim(), end: { after: piece.node }, start: { after: piece.node } });
                return;
            }
            var value = piece.value;
            var i = 0;
            while (i < value.length) {
                if (!inCode && value.substr(i, 3) === '```') {
                    flush();
                    inCode = true;
                    buf = '```';
                    startAt = { node: piece.node, offset: i };
                    endAt = { node: piece.node, offset: i + 3 };
                    i += 3;
                    continue;
                }
                if (inCode && value.substr(i, 3) === '```') {
                    buf += '```';
                    endAt = { node: piece.node, offset: i + 3 };
                    i += 3;
                    flush('code');
                    inCode = false;
                    continue;
                }
                if (!inCode) {
                    var blank = blankLength(value, i);
                    if (blank) {
                        flush();
                        i += blank;
                        continue;
                    }
                }
                if (!startAt) startAt = { node: piece.node, offset: i };
                buf += value.charAt(i);
                endAt = { node: piece.node, offset: i + 1 };
                i += 1;
            }
        });
        flush(inCode ? 'code' : '');
        return mergeStructural(blocks);
    }
    function messageNodes(root) {
        var out = [];
        var child = root.firstChild;
        while (child) {
            if (child.nodeType === 1 && child.classList && child.classList.contains('msg')) out.push(child);
            child = child.nextSibling;
        }
        return out;
    }
    function messageTextEl(msg) {
        var child = msg.firstChild;
        while (child) {
            if (child.nodeType === 1 && child.classList && child.classList.contains('msg-text')) return child;
            child = child.nextSibling;
        }
        return null;
    }
    function bubbleEnd(end) {
        if (!end || end.after || !end.node) return end;
        if (!end.node.nodeValue || end.offset < end.node.nodeValue.length) return end;
        var node = end.node;
        while (node.parentNode && !(node.parentNode.classList && node.parentNode.classList.contains('msg-text'))) {
            var parent = node.parentNode;
            var tag = parent.tagName;
            var inline = tag === 'B' || tag === 'STRONG' || tag === 'A' || tag === 'SPAN' || tag === 'EM' || tag === 'I' || tag === 'U' || tag === 'CODE' || tag === 'SMALL' || tag === 'SUP' || tag === 'SUB' || tag === 'MARK';
            if (!inline || node.nextSibling) break;
            node = parent;
        }
        if (node !== end.node) return { after: node };
        return end;
    }
    function pendingContentCount(root) {
        var msgs = window._currentMsgs;
        var offset = window._currentOffset;
        if (!msgs || !msgs.length || typeof offset !== 'number') return 0;
        var rendered = messageNodes(root).length;
        var start = offset < rendered ? rendered : offset;
        var extra = 0;
        var i;
        for (i = start; i < msgs.length; i++) {
            if (msgs[i] && msgs[i].text) extra += contentParagraphsFromSource(msgs[i].text).length;
        }
        return extra;
    }
    function scrollBehavior() {
        try {
            if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'auto';
        } catch (e) {}
        return 'smooth';
    }
    function scrollToDiscussion() {
        var target = document.getElementById('community-discussion') || document.getElementById('topic-discussion-live');
        if (!target) return;
        var behavior = scrollBehavior();
        var main = document.getElementById('main');
        if (main && target.getBoundingClientRect && main.getBoundingClientRect && typeof main.scrollTo === 'function') {
            var delta = topicStickyScrollDelta(target.getBoundingClientRect().top, main.getBoundingClientRect().top, stickyCoverPx());
            main.scrollTo({ top: Math.max(0, (main.scrollTop || 0) + delta), behavior: behavior });
            return;
        }
        if (typeof target.scrollIntoView === 'function') target.scrollIntoView({ behavior: behavior, block: 'start' });
    }
    function firstButton(node) {
        var child = node && node.firstChild;
        while (child) {
            if (child.nodeType === 1 && child.tagName === 'BUTTON') return child;
            if (child.nodeType === 1) {
                var nested = firstButton(child);
                if (nested) return nested;
            }
            child = child.nextSibling;
        }
        return null;
    }
    function focusComposer() {
        var area = document.getElementById('topic-discussion-input');
        if (area && typeof area.focus === 'function') {
            area.focus();
            return;
        }
        var composer = document.getElementById('topic-discussion-composer');
        var signIn = composer ? firstButton(composer) : null;
        if (signIn && typeof signIn.focus === 'function') signIn.focus();
    }
    function openTopicConversation() {
        if (!document.getElementById('topic-discussion-live') && window.currentChannelId && typeof window.mountTopicDiscussion === 'function') {
            window.mountTopicDiscussion(window.currentChannelId);
        }
        setOpen(true);
        scrollToDiscussion();
        focusComposer();
    }
    window.bqOpenTopicConversation = openTopicConversation;
    function conversationButton(index, text) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'td-convo-btn';
        button.textContent = '💬 Start a conversation';
        button.setAttribute('aria-label', 'Start a conversation about ' + topicTitle());
        var accepted = acceptClientAnchor(index, anchorFingerprint(text));
        if (accepted) {
            button.setAttribute('data-anchor-index', String(accepted.index));
            button.setAttribute('data-anchor-hash', accepted.hash);
        }
        button.addEventListener('click', function(event) {
            if (event && event.preventDefault) event.preventDefault();
            if (event && event.stopPropagation) event.stopPropagation();
            rememberAnchor(index, text);
            if (document.getElementById('topic-discussion-composer')) renderComposer();
            openTopicConversation();
        });
        return button;
    }
    function tightenPromptGap(button) {
        var next = button && button.nextSibling;
        if (!next || next.nodeType !== 3) return;
        var value = String(next.nodeValue || '');
        var trimmed = value.replace(/^\n+/, '');
        if (trimmed !== value) next.nodeValue = trimmed;
    }
    function insertPromptAt(end, button) {
        if (!end) return;
        if (end.after) {
            if (!end.after.parentNode || insideBlocked(end.after)) return;
            if (end.after.nextSibling) end.after.parentNode.insertBefore(button, end.after.nextSibling);
            else end.after.parentNode.appendChild(button);
            tightenPromptGap(button);
            return;
        }
        var node = end.node;
        if (!node || !node.parentNode || insideBlocked(node)) return;
        var offset = end.offset || 0;
        if (node.nodeValue && offset < node.nodeValue.length) {
            var right = node.splitText(offset);
            node.parentNode.insertBefore(button, right);
            tightenPromptGap(button);
            return;
        }
        if (node.nextSibling) node.parentNode.insertBefore(button, node.nextSibling);
        else node.parentNode.appendChild(button);
        tightenPromptGap(button);
    }
    function collectContentBlocks(root) {
        var rendered = [];
        if (!root) return rendered;
        messageNodes(root).forEach(function(msg) {
            var textEl = messageTextEl(msg);
            if (!textEl) return;
            paragraphsInElement(textEl).forEach(function(block) {
                if (isContentKind(block.kind)) rendered.push(block);
            });
        });
        return rendered;
    }
    function findTopicBlock(root, anchor, allowIndex) {
        var accepted = acceptClientAnchor(anchor && anchor.index, anchor && anchor.hash);
        if (!accepted || !root) return null;
        var blocks = collectContentBlocks(root);
        var i;
        for (i = 0; i < blocks.length; i++) {
            if (anchorFingerprint(blocks[i].text) === accepted.hash) return { block: blocks[i], index: i, how: 'hash' };
        }
        if (allowIndex && accepted.index < blocks.length) return { block: blocks[accepted.index], index: accepted.index, how: 'index' };
        return null;
    }
    function revealAnchorBlock(anchor) {
        var root = document.getElementById('msgs');
        if (!root) return null;
        injectTopicPrompts();
        var found = findTopicBlock(root, anchor, false);
        if (found) return found;
        var guard = 0;
        var lastOffset = null;
        while (guard < 80 && document.getElementById('loadMoreBtn') && typeof window.loadMoreMsgs === 'function') {
            if (window._currentOffset === lastOffset) break;
            lastOffset = window._currentOffset;
            try { window.loadMoreMsgs(); } catch (err) { break; }
            guard += 1;
            found = findTopicBlock(root, anchor, false);
            if (found) return found;
        }
        return findTopicBlock(root, anchor, true);
    }
    function whenTopicRendered(done) {
        var tries = 0;
        function step() {
            var root = document.getElementById('msgs');
            var blocks = collectContentBlocks(root);
            var waiting = window._currentMsgs && window._currentMsgs.length && !blocks.length;
            if (!waiting || tries > 25) { done(root); return; }
            tries += 1;
            setTimeout(step, 80);
        }
        step();
    }
    window.bqFindTopicBlock = function(root, anchor, allowIndex) {
        return findTopicBlock(root, anchor, allowIndex !== false);
    };
    function injectTopicPrompts() {
        var root = document.getElementById('msgs');
        if (!root || root.classList && root.classList.contains('gallery-grid')) return;
        injectStyle();
        clearParagraphFlash(root);
        removePrompts(root);
        var rendered = collectContentBlocks(root);
        var pending = pendingContentCount(root);
        var total = rendered.length + pending;
        if (!total) return;
        var slots = planTopicConversationButtons(total, promptsUseful(rendered));
        var points = [];
        slots.forEach(function(index) {
            if (index >= 0 && index < rendered.length) {
                points.push({ end: bubbleEnd(rendered[index].end), index: index, text: rendered[index].text });
            }
        });
        for (var s = points.length - 1; s >= 0; s--) insertPromptAt(points[s].end, conversationButton(points[s].index, points[s].text));
    }
    window.bqInjectTopicPrompts = injectTopicPrompts;

    function shell(channelId) {
        injectStyle();
        var legacy = document.getElementById('community-discussion-archive');
        var section = document.getElementById('community-discussion');
        if (section && section.getAttribute('data-channel-id') !== channelId) {
            section.parentNode.removeChild(section);
            section = null;
        }
        if (!section) {
            section = el('section', 'td-section');
            section.id = 'community-discussion';
            section.setAttribute('data-channel-id', channelId);
            var toggle = btn('Community discussion', 'td-toggle', function() {
                var body = document.getElementById('topic-discussion-body');
                var opening = !!(body && body.hidden);
                if (opening) {
                    clearPendingAnchor();
                    renderComposer();
                }
                setOpen(opening);
            });
            toggle.id = 'community-discussion-toggle';
            toggle.setAttribute('aria-expanded', 'false');
            toggle.setAttribute('aria-controls', 'topic-discussion-body');
            var label = el('span');
            label.textContent = 'Community discussion';
            var count = el('small');
            count.id = 'topic-discussion-count';
            toggle.textContent = '';
            toggle.appendChild(label);
            toggle.appendChild(count);
            section.appendChild(toggle);
            var body = el('div', 'td-body');
            body.id = 'topic-discussion-body';
            body.hidden = true;
            var archive = legacy || el('div', 'td-archive');
            archive.id = 'community-discussion-archive';
            archive.className = 'td-archive';
            archive.setAttribute('data-legacy', 'discord');
            var live = el('div', 'td-live');
            live.id = 'topic-discussion-live';
            var more = btn('Earlier comments', 'td-btn', loadEarlier);
            more.id = 'topic-discussion-more';
            more.hidden = true;
            var composer = el('div', 'td-compose');
            composer.id = 'topic-discussion-composer';
            body.appendChild(archive);
            body.appendChild(live);
            body.appendChild(more);
            body.appendChild(composer);
            section.appendChild(body);
        }
        return section;
    }

    window.mountTopicDiscussion = function(channelId) {
        if (!channelId || typeof document === 'undefined') return;
        state.channelId = channelId;
        state.posts = [];
        state.cursor = null;
        state.pages = 1;
        state.parentId = '';
        state.pendingTries = 0;
        clearPendingAnchor();
        if (state.pendingTimer) { clearTimeout(state.pendingTimer); state.pendingTimer = null; }
        Object.keys(state.replyUnsubs).forEach(function(id) { state.replyUnsubs[id](); });
        state.replyUnsubs = {};
        var msgs = document.getElementById('msgs');
        if (!msgs) return;
        var section = shell(channelId);
        if (section.parentNode !== msgs) msgs.appendChild(section);
        var open = false;
        try { open = sessionStorage.getItem('td_open_' + channelId) === '1'; } catch (e) {}
        if (window._topicDeepLink && window._topicDeepLink.channelId === channelId) open = true;
        setOpen(open);
        renderComposer();
        watchTop();
        if (typeof auth !== 'undefined' && auth && auth.onAuthStateChanged && !window._tdAuthHook) {
            window._tdAuthHook = true;
            auth.onAuthStateChanged(function() { renderComposer(); renderInlineComposer(); paint(); });
        }
        injectTopicPrompts();
    };

    window.bqOpenTopicPost = function(channelId, postId, anchorIndex, anchorHash) {
        if (!/^[A-Za-z0-9_-]+$/.test(channelId || '') || !/^[A-Za-z0-9_-]+$/.test(postId || '')) return false;
        var link = { channelId: channelId, postId: postId, done: false, working: false };
        var hint = acceptClientAnchor(anchorIndex, anchorHash);
        if (hint) {
            link.anchorIndex = hint.index;
            link.anchorHash = hint.hash;
        }
        window._topicDeepLink = link;
        if (window.currentChannelId === channelId && document.getElementById('topic-discussion-live')) {
            focusPending();
            return true;
        }
        if (typeof window.go === 'function') window.go(channelId);
        return true;
    };
})();
