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

    function timeLabel(ts) {
        var ms = 0;
        if (!ts) return '';
        if (typeof ts.toDate === 'function') ms = ts.toDate().getTime();
        else if (typeof ts.toMillis === 'function') ms = ts.toMillis();
        else if (typeof ts === 'number') ms = ts;
        if (!ms) return '';
        var sec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
        if (sec < 60) return 'just now';
        if (sec < 3600) return Math.floor(sec / 60) + 'm';
        if (sec < 86400) return Math.floor(sec / 3600) + 'h';
        return Math.floor(sec / 86400) + 'd';
    }

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
            '.td-time,.td-anchor{font-size:0.68rem;color:var(--text-faint,#64748b);}',
            '.td-text{font-size:0.92rem;line-height:1.45;color:var(--text,#e2e8f0);white-space:pre-wrap;word-break:break-word;}',
            '.td-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}',
            '.td-btn{padding:4px 8px;border-radius:8px;border:1px solid var(--border,#1e293b);background:none;color:var(--text-muted,#94a3b8);font-size:0.72rem;font-weight:700;cursor:pointer;font-family:inherit;}',
            '.td-asof{margin-top:6px;font-size:0.72rem;color:var(--text-faint,#64748b);}',
            '.td-links,.td-followups{margin-top:8px;}',
            '.td-extra-label{font-size:0.68rem;color:var(--text-faint,#64748b);margin-bottom:4px;}',
            '.td-topic{display:block;width:100%;margin-top:4px;padding:8px;background:var(--accent,#f97316);border:none;border-radius:8px;color:#fff;font-size:0.82rem;font-weight:800;cursor:pointer;font-family:inherit;text-align:left;}',
            '.td-follow{display:block;width:100%;margin-top:4px;padding:6px 8px;background:none;border:1px solid var(--border,#1e293b);border-radius:8px;color:var(--text-muted,#94a3b8);font-size:0.78rem;cursor:pointer;font-family:inherit;text-align:left;}',
            '.td-compose{display:flex;flex-direction:column;gap:8px;margin-top:12px;}',
            '.td-compose textarea{width:100%;box-sizing:border-box;min-height:72px;max-height:180px;padding:12px;border-radius:12px;border:1px solid var(--border,#1e293b);background:var(--input-bg,#020617);color:var(--text,#e2e8f0);font-size:16px;font-family:inherit;resize:vertical;}',
            '.td-compose-row{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;}',
            '.td-send{padding:10px 16px;border:none;border-radius:10px;background:var(--accent,#f97316);color:#fff;font-weight:800;cursor:pointer;font-family:inherit;}',
            '.td-send:disabled{opacity:0.55;cursor:default;}',
            '.td-note{font-size:0.75rem;color:var(--text-muted,#94a3b8);line-height:1.4;}',
            '.td-fallback{padding:10px 12px;border-radius:10px;background:rgba(249,115,22,0.08);color:var(--text-muted,#94a3b8);font-size:0.85rem;margin-bottom:10px;}',
            '.td-replies{display:flex;flex-direction:column;gap:8px;margin-top:8px;}',
            '.topic-post-highlight{animation:topicPostFlash 2.6s ease forwards;border-color:#f97316 !important;}',
            '@keyframes topicPostFlash{0%,45%{box-shadow:0 0 0 3px rgba(249,115,22,0.9);background:rgba(249,115,22,0.22);}100%{box-shadow:0 0 0 0 rgba(249,115,22,0);background:transparent;}}',
            '@media (max-width:420px){.td-section{margin:20px 10px 28px;}.td-post.td-reply{margin-left:12px;}.td-body{padding:0 10px 12px;}}'
        ].join('');
        document.head.appendChild(style);
    }

    function avatarFor(post) {
        if (post && post.isNacho) {
            var img = el('img', 'td-avatar');
            img.src = '/nacho-deer.svg';
            img.alt = 'Nacho';
            img.width = 32;
            img.height = 32;
            img.addEventListener('error', function () {
                var fallback = el('div', 'td-avatar-fallback');
                fallback.textContent = '🦌';
                if (img.parentNode && img.parentNode.replaceChild) img.parentNode.replaceChild(fallback, img);
            });
            return img;
        }
        var fallback = el('div', 'td-avatar-fallback');
        var name = post && post.name ? String(post.name) : '?';
        fallback.textContent = name.trim().charAt(0).toUpperCase() || '?';
        return fallback;
    }

    function appendNachoExtras(main, post) {
        if (!post || !post.isNacho) return;
        var links = Array.isArray(post.links) ? post.links.slice(0, 3) : [];
        if (links.length) {
            var box = el('div', 'td-links');
            box.setAttribute('data-bq-links', '1');
            var label = el('div', 'td-extra-label');
            label.textContent = 'Learn more';
            box.appendChild(label);
            links.forEach(function(item) {
                if (!item) return;
                var raw = String(item.id || '');
                var id = raw.replace(/[^a-z0-9_-]/gi, '');
                if (!id || id !== raw) return;
                var kind = item.kind === 'app' ? 'app' : 'topic';
                var button = el('button', 'td-topic');
                button.type = 'button';
                button.setAttribute('data-bq-topic', id);
                button.setAttribute('data-bq-kind', kind);
                button.textContent = String(item.title || id);
                button.addEventListener('click', function(ev) {
                    ev.stopPropagation();
                    ev.preventDefault();
                    if (kind === 'app' && typeof window.bqOpenFeature === 'function') window.bqOpenFeature(id);
                    else if (typeof window.go === 'function') window.go(id);
                });
                box.appendChild(button);
            });
            main.appendChild(box);
        }
        var followUps = Array.isArray(post.followUps) ? post.followUps.slice(0, 3) : [];
        var shown = [];
        followUps.forEach(function(q) {
            var text = String(q || '').replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim();
            if (text.length < 8 || text.length > 90 || text.charAt(text.length - 1) !== '?') return;
            if (/\b(what do you think|do you think|how do you feel|your opinion)\b/i.test(text)) return;
            shown.push(text);
        });
        if (shown.length) {
            var fbox = el('div', 'td-followups');
            fbox.setAttribute('data-bq-followups', '1');
            var flabel = el('div', 'td-extra-label');
            flabel.textContent = 'You might also ask:';
            fbox.appendChild(flabel);
            shown.forEach(function(text) {
                var button = el('button', 'td-follow');
                button.type = 'button';
                button.setAttribute('data-bq-chip', '1');
                button.setAttribute('data-q', text);
                button.textContent = text;
                button.addEventListener('click', function(ev) {
                    ev.stopPropagation();
                    ev.preventDefault();
                    if (typeof window.bqAskFollowUp === 'function') window.bqAskFollowUp(text);
                });
                fbox.appendChild(button);
            });
            main.appendChild(fbox);
        }
    }

    function renderPost(post, ctx) {
        injectStyle();
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
        var time = el('span', 'td-time');
        time.textContent = timeLabel(post.createdAt || post.createdAtMs);
        meta.appendChild(time);
        if (post.anchorIndex != null && post.anchorIndex !== '') {
            var anchor = el('span', 'td-anchor');
            anchor.textContent = 'On note #' + post.anchorIndex;
            meta.appendChild(anchor);
        }
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
        var showBody = !post.deleted && !(post.hidden && !who.admin);
        if (post.deleted) text.textContent = 'Comment removed';
        else if (!showBody) text.textContent = '';
        else text.textContent = post.text || '';
        main.appendChild(text);
        if (showBody && post.isNacho && post.asOf != null && post.asOf !== '') {
            var asMs = typeof post.asOf === 'number' ? post.asOf : Date.parse(post.asOf);
            if (isFinite(asMs)) {
                var asof = el('div', 'td-asof');
                var asIso = '';
                try { asIso = new Date(asMs).toISOString(); } catch (eAs) { asIso = String(post.asOf); }
                asof.setAttribute('data-bq-asof', asIso);
                var asLabel = '';
                try { asLabel = new Date(asMs).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); } catch (eAs2) { asLabel = ''; }
                if (asLabel) {
                    asof.textContent = 'As of ' + asLabel;
                    main.appendChild(asof);
                }
            }
        }
        if (showBody) appendNachoExtras(main, post);
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
        replyName: ''
    };

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

    function paint() {
        var live = document.getElementById('topic-discussion-live');
        var count = document.getElementById('topic-discussion-count');
        if (!live) return;
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
            host.appendChild(btn('Sign in', 'td-send', function() {
                if (typeof showUsernamePrompt === 'function') showUsernamePrompt();
            }));
            return;
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
        var controls = el('div', 'td-compose-row');
        var hint = el('span', 'td-note');
        hint.textContent = 'Nacho may answer questions. Posting does not earn XP or tickets.';
        var send = btn('Post', 'td-send', function() { submit(area, send); });
        controls.appendChild(hint);
        controls.appendChild(count);
        controls.appendChild(send);
        host.appendChild(controls);
    }

    function submit(area, send) {
        var text = area.value.trim();
        if (!text) { toast('Write a comment first.'); return; }
        var who = viewer();
        if (!who.signedIn) { toast('Sign in to join the discussion.'); return; }
        if (!who.name || who.name.length < 2) { toast('Set a username first.'); return; }
        send.disabled = true;
        var payload = { channelId: state.channelId, text: text };
        if (state.parentId) payload.parentId = state.parentId;
        var anchor = window._topicAnchorIndex;
        if (anchor != null && anchor !== '' && !payload.parentId) payload.anchorIndex = anchor;
        callFn('postTopicComment', payload).then(function() {
            area.value = '';
            state.parentId = '';
            state.replyName = '';
            renderComposer();
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

    function focusPending() {
        var link = window._topicDeepLink;
        if (!link || link.done || link.channelId !== state.channelId) return;
        setOpen(true);
        ensurePost(link.postId).then(function(result) {
            if (!window._topicDeepLink || window._topicDeepLink.postId !== link.postId) return;
            if (result === 'removed') {
                window._topicDeepLink.done = true;
                showFallback('That comment was removed.');
                return;
            }
            var node = document.getElementById('td-post-' + link.postId);
            if (!node) return;
            window._topicDeepLink.done = true;
            scrollPostIntoView(node);
            try {
                history.replaceState({ channel: link.channelId, topicPost: link.postId }, '', '#topic=' + link.channelId + '&post=' + link.postId);
            } catch (e) {}
        });
    }

    window._topicDiscussionFocus = focusPending;

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
                setOpen(body && body.hidden);
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
            auth.onAuthStateChanged(function() { renderComposer(); paint(); });
        }
    };

    window.bqOpenTopicPost = function(channelId, postId) {
        if (!/^[A-Za-z0-9_-]+$/.test(channelId || '') || !/^[A-Za-z0-9_-]+$/.test(postId || '')) return false;
        window._topicDeepLink = { channelId: channelId, postId: postId, done: false };
        if (window.currentChannelId === channelId && document.getElementById('topic-discussion-live')) {
            focusPending();
            return true;
        }
        if (typeof window.go === 'function') window.go(channelId);
        return true;
    };
})();
