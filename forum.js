// © 2024-2026 603BTC LLC. All rights reserved.
// This code is proprietary. See LICENSE file. Do not copy or redistribute.
// =============================================
// 🗣️ Bitcoin Education Archive — PlebTalk
// Stacker News-inspired discussion board
// =============================================

(function() {

// Admin UIDs — can delete any post/reply
var FORUM_ADMINS = [];
function isForumAdmin() {
    if (!auth || !auth.currentUser) return false;
    if (FORUM_ADMINS.indexOf(auth.currentUser.uid) !== -1) return true;
    // Also check email
    var email = auth.currentUser.email || '';
    return email === 'needcreations@gmail.com';
}

var FORUM_CATEGORIES = [
    { id: 'general', name: 'General', emoji: '💬' },
    { id: 'beginner', name: 'Beginner Questions', emoji: '🌱' },
    { id: 'lightning', name: 'Lightning', emoji: '⚡' },
    { id: 'mining', name: 'Mining', emoji: '⛏️' },
    { id: 'security', name: 'Security & Privacy', emoji: '🔒' },
    { id: 'wallets', name: 'Wallets & Self-Custody', emoji: '💼' },
    { id: 'economics', name: 'Economics & Theory', emoji: '📈' },
    { id: 'news', name: 'News & Events', emoji: '📰' },
    { id: 'dev', name: 'Development & Tech', emoji: '⚙️' },
    { id: 'selfpromo', name: 'Self-Promotion', emoji: '📣' },
    { id: 'offtopic', name: 'Off-Topic', emoji: '🎭' },
];

// ---- Forum Rules ----
var FORUM_RULES = [
    { emoji: '🤝', title: 'Be Respectful', desc: 'Treat everyone with respect. No hate speech, harassment, bullying, threats, discrimination, racism, sexism, or sexual content. Attack ideas, not people.' },
    { emoji: '🎯', title: 'Stay On Topic', desc: 'Keep posts relevant to Bitcoin and the category you\'re posting in. Self-promotion belongs in the Self-Promotion category only.' },
    { emoji: '🚫', title: 'No Spam or Scams', desc: 'No repetitive posts, spam, phishing links, pump-and-dump schemes, fake giveaways, or scam promotions. One post per topic.' },
    { emoji: '🔒', title: 'Protect Privacy', desc: 'Never share personal information about yourself or others — no real names, addresses, phone numbers, or private keys. Stay pseudonymous.' },
    { emoji: '⚠️', title: 'No Financial Advice', desc: 'Don\'t tell others to buy, sell, or invest. Share knowledge and resources, not financial directives. Always add "not financial advice" disclaimers.' },
    { emoji: '🪙', title: 'Bitcoin Only', desc: 'This is a Bitcoin education forum. Altcoin shilling, ICO promotion, and "next Bitcoin" posts will be removed.' },
    { emoji: '📝', title: 'Quality Content', desc: 'Put effort into your posts. No low-effort single-word posts, all-caps titles, or clickbait. Ask clear questions and provide context.' },
    { emoji: '🤖', title: 'No Bot Activity', desc: 'Automated posting, bot accounts, and AI-generated spam are not allowed. Be a real human participating in real conversations.' },
    { emoji: '⚖️', title: 'No Illegal Content', desc: 'Nothing illegal, including but not limited to: piracy, hacking services, drug markets, weapons, or any content that violates applicable laws.' },
    { emoji: '👮', title: 'Moderators Have Final Say', desc: 'Posts that violate these rules will be removed without notice. Repeat offenders may be banned. If you see a rule violation, report it.' },
];

function showForumRules(force) {
    var html = '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if(event.target===this && force)this.remove()">' +
        '<div style="background:rgba(15,23,42,0.85);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.1);border-radius:24px;padding:24px;max-width:480px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5);animation:fadeSlideIn 0.3s;-webkit-overflow-scrolling:touch;">' +
            '<div style="text-align:center;margin-bottom:16px;">' +
                '<div style="font-size:2rem;margin-bottom:6px;">📜</div>' +
                '<h2 style="color:var(--heading);font-size:1.2rem;font-weight:800;margin:0 0 4px;">PlebTalk Rules</h2>' +
                '<div style="color:var(--text-muted);font-size:0.8rem;">Please read before posting</div>' +
            '</div>';

    for (var i = 0; i < FORUM_RULES.length; i++) {
        var r = FORUM_RULES[i];
        html += '<div style="display:flex;gap:10px;margin-bottom:12px;align-items:flex-start;">' +
            '<span style="font-size:1.2rem;flex-shrink:0;margin-top:2px;">' + r.emoji + '</span>' +
            '<div>' +
                '<div style="color:var(--heading);font-size:0.85rem;font-weight:700;margin-bottom:2px;">' + r.title + '</div>' +
                '<div style="color:var(--text-muted);font-size:0.8rem;line-height:1.4;">' + r.desc + '</div>' +
            '</div>' +
        '</div>';
    }

    html += '<button onclick="acceptForumRules()" style="width:100%;padding:12px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;margin-top:8px;touch-action:manipulation;">I Understand — Let\'s Discuss Bitcoin! 🦌</button>';
    html += '</div></div>';

    var div = document.createElement('div');
    div.id = 'forumRulesOverlay';
    div.innerHTML = html;
    document.body.appendChild(div);
}

window.acceptForumRules = function() {
    localStorage.setItem('btc_forum_rules_accepted', 'true');
    var overlay = document.getElementById('forumRulesOverlay');
    if (overlay) overlay.remove();
};

window.showForumRulesBtn = function() {
    showForumRules(true);
};

// Check if user has seen rules on first forum visit
function checkForumRules() {
    if (localStorage.getItem('btc_forum_rules_accepted') !== 'true') {
        showForumRules(false);
    }
}

// Profanity filter (shared approach with Nacho)
var FORUM_BLOCKED = ['fuck','shit','bitch','dick','cock','pussy','cunt','nigger','nigga','fag','retard','nazi','hitler','kkk','porn','hentai','rape','pedo'];
function isCleanText(text) {
    var lower = text.toLowerCase().replace(/[^a-z\s]/g, '');
    var words = lower.split(/\s+/);
    for (var i = 0; i < words.length; i++) {
        for (var j = 0; j < FORUM_BLOCKED.length; j++) {
            if (words[i] === FORUM_BLOCKED[j]) return false;
            if (FORUM_BLOCKED[j].length >= 4 && words[i].indexOf(FORUM_BLOCKED[j]) !== -1) return false;
        }
    }
    return true;
}

// Sanitize HTML
function fEsc(str) { return typeof escapeHtml === 'function' ? escapeHtml(str) : String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Time ago helper
function timeAgo(ts) {
    var now = Date.now();
    var d = ts && ts.toDate ? ts.toDate().getTime() : (typeof ts === 'number' ? ts : new Date(ts).getTime());
    var diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff/60) + 'm ago';
    if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff/86400) + 'd ago';
    return new Date(d).toLocaleDateString();
}

// Navigate back to forum list
window.forumBack = function() {
    history.back();
};

// State
var forumSort = 'recent';
var forumCategory = 'all';
var forumPage = 'list'; // list | post | new
var forumCurrentPost = null;
var forumPostsCache = [];
var forumLastLoad = 0;

// ---- Render Forum ----
window.renderForum = function() {
    var fc = document.getElementById('forumContainer');
    
    
    if (!fc) return;
    
    
    fc.innerHTML = '';

    var html = '<div style="max-width:700px;margin:0 auto;padding:16px 12px;">';

    // Header
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:10px;">' +
        '<div style="min-width:0;">' +
            '<h2 style="color:var(--heading);font-size:1.3rem;font-weight:800;margin:0;">🗣️ PlebTalk</h2>' +
            '<div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px;">Discuss Bitcoin with fellow learners</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-shrink:0;">' +
            '<button onclick="showForumRulesBtn()" style="padding:10px 14px;background:none;border:1px solid var(--border);color:var(--text-muted);border-radius:10px;font-size:0.85rem;cursor:pointer;font-family:inherit;touch-action:manipulation;white-space:nowrap;">📜 Rules</button>' +
            '<button onclick="forumNewPost()" style="padding:10px 18px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;touch-action:manipulation;white-space:nowrap;">+ New Post</button>' +
        '</div>' +
    '</div>';

    // Sort + Filter bar
    html += '<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;align-items:center;">';
    // Sort buttons
    ['recent','top','discussed'].forEach(function(s) {
        var labels = { recent: '🕐 Recent', top: '🔥 Top', discussed: '💬 Discussed' };
        var active = forumSort === s;
        html += '<button onclick="forumSetSort(\'' + s + '\')" style="padding:8px 12px;border-radius:16px;font-size:0.75rem;cursor:pointer;font-family:inherit;border:1px solid ' + (active ? 'var(--accent)' : 'var(--border)') + ';background:' + (active ? 'var(--accent-bg)' : 'none') + ';color:' + (active ? 'var(--accent)' : 'var(--text-muted)') + ';font-weight:' + (active ? '700' : '400') + ';touch-action:manipulation;">' + labels[s] + '</button>';
    });
    // Category dropdown
    html += '<select id="forumCatFilter" onchange="forumSetCategory(this.value)" style="padding:8px 10px;border-radius:8px;background:var(--input-bg);border:1px solid var(--border);color:var(--text);font-size:0.75rem;font-family:inherit;cursor:pointer;flex:1;min-width:120px;">';
    html += '<option value="all"' + (forumCategory === 'all' ? ' selected' : '') + '>All Categories</option>';
    FORUM_CATEGORIES.forEach(function(c) {
        html += '<option value="' + c.id + '"' + (forumCategory === c.id ? ' selected' : '') + '>' + c.emoji + ' ' + c.name + '</option>';
    });
    html += '</select></div>';

    // Posts list
    html += '<div id="forumPosts"><div style="text-align:center;padding:40px;color:var(--text-muted);">Loading posts...</div></div>';

    html += '</div>';
    fc.innerHTML = html;
    document.getElementById('main').scrollTop = 0;

    // Show rules on first visit
    checkForumRules();

    // Load posts
    forumLoadPosts();
};

// ---- Load Posts ----
// Real-time forum listener
window._forumUnsubscribe = null;

window.forumLoadPosts = async function() {
    var container = document.getElementById('forumPosts');
    if (!container || typeof db === 'undefined') return;

    // Unsubscribe previous listener if any
    if (window._forumUnsubscribe) {
        window._forumUnsubscribe();
        window._forumUnsubscribe = null;
    }

    try {
        var sortField = forumSort === 'top' ? 'upvotes' : forumSort === 'discussed' ? 'replyCount' : 'createdAt';
        var query;

        if (forumCategory !== 'all') {
            query = db.collection('forum_posts')
                .where('category', '==', forumCategory)
                .orderBy(sortField, 'desc')
                .limit(50);
        } else {
            query = db.collection('forum_posts').orderBy(sortField, 'desc').limit(50);
        }

        // Use onSnapshot for real-time updates
        window._forumUnsubscribe = query.onSnapshot(function(snap) {
            var posts = [];
            snap.forEach(function(doc) { posts.push({ id: doc.id, ...doc.data() }); });
            forumPostsCache = posts;
            forumLastLoad = Date.now();

            // Re-render only if we're on the forum list view (not viewing a single post)
            var container = document.getElementById('forumPosts');
            if (container && !document.getElementById('forumPostView')) {
                forumRenderPosts(posts, container);
            }
        }, function(err) {
            console.log('Forum listener error:', err);
            // Fallback to one-time read
            forumLoadPostsFallback();
        });

        // Initial load is handled by the first onSnapshot callback
    } catch(e) {
        console.log('Forum load error:', e);
        forumLoadPostsFallback();
    }
};

// Fallback: one-time read if real-time listener fails
async function forumLoadPostsFallback() {
    var container = document.getElementById('forumPosts');
    if (!container) return;
    try {
        var sortField = forumSort === 'top' ? 'upvotes' : forumSort === 'discussed' ? 'replyCount' : 'createdAt';
        var query = forumCategory !== 'all'
            ? db.collection('forum_posts').where('category', '==', forumCategory).orderBy(sortField, 'desc').limit(50)
            : db.collection('forum_posts').orderBy(sortField, 'desc').limit(50);
        var snap = await query.get();
        var posts = [];
        snap.forEach(function(doc) { posts.push({ id: doc.id, ...doc.data() }); });
        forumPostsCache = posts;
        forumRenderPosts(posts, container);
    } catch(e) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#ef4444;">Error loading posts. Try refreshing.</div>';
    }
}

// Render forum post list
function forumRenderPosts(posts, container) {
    if (!container) return;
    if (posts.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;">' +
            '<div style="font-size:2rem;margin-bottom:8px;">🦌</div>' +
            '<div style="color:var(--text-muted);">No posts yet. Be the first to start a discussion!</div>' +
        '</div>';
        return;
    }

    var html = '';
    posts.forEach(function(p) {
        var lv = typeof getLevel === 'function' ? getLevel(p.authorPoints || 0) : { emoji: '🟢' };
        var cat = FORUM_CATEGORIES.find(function(c) { return c.id === p.category; });
        var catLabel = cat ? cat.emoji + ' ' + cat.name : '';
        var isOwn = auth && auth.currentUser && p.authorId === auth.currentUser.uid;
        var canDelete = isOwn || isForumAdmin();
        var hasVoted = p.voters && auth && auth.currentUser && p.voters.indexOf(auth.currentUser.uid) !== -1;

        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px;cursor:pointer;transition:0.2s;-webkit-tap-highlight-color:rgba(247,147,26,0.1);" onclick="forumViewPost(\'' + p.id + '\')" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
            '<div style="display:flex;gap:10px;">' +
                '<div style="display:flex;flex-direction:column;align-items:center;min-width:36px;flex-shrink:0;">' +
                    '<button onclick="event.stopPropagation();forumVotePost(\'' + p.id + '\')" style="background:none;border:none;cursor:pointer;font-size:1.2rem;padding:4px;color:' + (hasVoted ? 'var(--accent)' : 'var(--text-faint)') + ';touch-action:manipulation;" title="Upvote">⚡</button>' +
                    '<span style="color:' + (hasVoted ? 'var(--accent)' : 'var(--text-muted)') + ';font-size:0.8rem;font-weight:700;">' + (p.upvotes || 0) + '</span>' +
                '</div>' +
                '<div style="flex:1;min-width:0;overflow:hidden;">' +
                    '<div style="color:var(--heading);font-size:0.9rem;font-weight:700;margin-bottom:3px;line-height:1.3;word-wrap:break-word;">' + fEsc(p.title) + '</div>' +
                    (p.body ? '<div style="color:var(--text-muted);font-size:0.75rem;line-height:1.4;margin-bottom:5px;overflow:hidden;max-height:2.6em;word-wrap:break-word;">' + fEsc(p.body).substring(0, 120) + (p.body.length > 120 ? '...' : '') + '</div>' : '') +
                    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
                        '<span onclick="event.stopPropagation();if(typeof showUserProfile===\'function\')showUserProfile(\'' + p.authorId + '\')" style="font-size:0.7rem;color:var(--text-faint);cursor:pointer;transition:0.2s;" onmouseover="this.style.color=\'var(--accent)\'" onmouseout="this.style.color=\'var(--text-faint)\'">' + lv.emoji + ' ' + fEsc(p.authorName || 'Anon') + '</span>' +
                        '<span style="font-size:0.65rem;color:var(--text-faint);">' + timeAgo(p.createdAt) + '</span>' +
                        '<span style="font-size:0.7rem;color:var(--text-faint);">💬 ' + (p.replyCount || 0) + '</span>' +
                        (catLabel ? '<span style="font-size:0.6rem;padding:2px 6px;background:var(--bg-side);border:1px solid var(--border);border-radius:8px;color:var(--text-faint);white-space:nowrap;">' + catLabel + '</span>' : '') +
                        (canDelete ? '<button onclick="event.stopPropagation();forumDeletePost(\'' + p.id + '\')" style="background:none;border:none;color:var(--text-faint);font-size:0.7rem;cursor:pointer;padding:4px;touch-action:manipulation;opacity:0.5;" title="Delete post">🗑️</button>' : '') +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    });

    container.innerHTML = html;
}

// ---- Sort/Filter ----
window.forumSetSort = function(s) { forumSort = s; renderForum(); };
window.forumSetCategory = function(c) { forumCategory = c; renderForum(); };

// ---- View Post ----
window.forumViewPost = async function(postId, fromPopState) {
    var fc = document.getElementById('forumContainer');
    if (!fc || typeof db === 'undefined') return;
    if (!fromPopState) history.pushState({ channel: 'forum', forumPost: postId }, '', '#forum/post/' + postId);
    fc.innerHTML = '<div style="max-width:700px;margin:0 auto;padding:20px 16px;"><div style="text-align:center;padding:100px 40px;display:flex;flex-direction:column;gap:12px;">' +
        '<div class="skeleton" style="height:40px;width:80%;margin:0 auto;"></div>' +
        '<div class="skeleton" style="height:20px;width:60%;margin:0 auto;opacity:0.6;"></div>' +
        '<div class="skeleton" style="height:20px;width:40%;margin:0 auto;opacity:0.4;"></div>' +
        '</div></div>';

    try {
        var doc = await db.collection('forum_posts').doc(postId).get();
        if (!doc.exists) { renderForum(); return; }
        var p = { id: doc.id, ...doc.data() };
        forumCurrentPost = p;
        var lv = typeof getLevel === 'function' ? getLevel(p.authorPoints || 0) : { emoji: '🟢' };
        var hasVoted = p.voters && auth && auth.currentUser && p.voters.indexOf(auth.currentUser.uid) !== -1;

        var html = '<div style="max-width:700px;margin:0 auto;padding:16px 12px;">';

        // Back button
        html += '<button onclick="forumBack()" style="background:none;border:none;color:var(--text-muted);font-size:0.85rem;cursor:pointer;padding:8px 0;margin-bottom:8px;font-family:inherit;touch-action:manipulation;">← Back to PlebTalk</button>';

        // Post
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<h2 style="color:var(--heading);font-size:1.15rem;font-weight:800;margin:0 0 8px;line-height:1.3;word-wrap:break-word;">' + fEsc(p.title) + '</h2>' +
            '<div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap;">' +
                '<span style="font-size:0.8rem;color:var(--text-muted);cursor:pointer;transition:0.2s;" onclick="if(typeof showUserProfile===\'function\')showUserProfile(\'' + p.authorId + '\')" onmouseover="this.style.color=\'var(--accent)\'" onmouseout="this.style.color=\'var(--text-muted)\'">' + lv.emoji + ' ' + fEsc(p.authorName || 'Anon') + '</span>' +
                '<span style="font-size:0.75rem;color:var(--text-faint);">' + timeAgo(p.createdAt) + '</span>' +
            '</div>';

        if (p.body) {
            // Simple markdown-ish: newlines to <br>, **bold**, links
            var bodyHtml = fEsc(p.body).replace(/\n/g, '<br>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            // Auto-link URLs
            bodyHtml = bodyHtml.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:var(--accent);">$1</a>');
            html += '<div style="color:var(--text);font-size:0.9rem;line-height:1.6;margin-bottom:12px;word-wrap:break-word;overflow-wrap:break-word;">' + bodyHtml + '</div>';
        }

        if (p.link) {
            html += '<a href="' + fEsc(p.link) + '" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;color:var(--accent);font-size:0.85rem;margin-bottom:12px;">🔗 ' + fEsc(p.link).substring(0, 60) + (p.link.length > 60 ? '...' : '') + '</a><br>';
        }

        // Vote + meta + admin delete
        var canDeletePost = (auth && auth.currentUser && p.authorId === auth.currentUser.uid) || isForumAdmin();
        html += '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' +
            '<button onclick="forumVotePost(\'' + p.id + '\')" style="display:flex;align-items:center;gap:4px;background:' + (hasVoted ? 'var(--accent-bg)' : 'none') + ';border:1px solid ' + (hasVoted ? 'var(--accent)' : 'var(--border)') + ';border-radius:16px;padding:6px 12px;cursor:pointer;color:' + (hasVoted ? 'var(--accent)' : 'var(--text-muted)') + ';font-size:0.8rem;font-weight:600;font-family:inherit;touch-action:manipulation;">⚡ ' + (p.upvotes || 0) + '</button>' +
            '<span style="color:var(--text-faint);font-size:0.8rem;">💬 ' + (p.replyCount || 0) + ' replies</span>' +
            (canDeletePost ? '<button onclick="forumDeletePost(\'' + p.id + '\')" style="background:none;border:1px solid var(--border);border-radius:16px;padding:4px 10px;color:#ef4444;font-size:0.75rem;cursor:pointer;font-family:inherit;touch-action:manipulation;">🗑️ Delete</button>' : '') +
        '</div>';
        html += '</div>';

        // Reply box
        if (auth && auth.currentUser && !auth.currentUser.isAnonymous) {
            html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:16px;">' +
                '<textarea id="forumReplyInput" rows="3" maxlength="1000" placeholder="Write a reply..." style="width:100%;padding:12px;background:var(--input-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:16px;font-family:inherit;outline:none;resize:vertical;box-sizing:border-box;margin-bottom:8px;min-height:70px;-webkit-appearance:none;"></textarea>' +
                '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
                    '<span id="forumReplyStatus" style="font-size:0.8rem;flex:1;min-width:0;"></span>' +
                    '<button onclick="forumSubmitReply(\'' + p.id + '\')" style="padding:10px 20px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;touch-action:manipulation;flex-shrink:0;">Reply</button>' +
                '</div></div>';
        } else {
            html += '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:0.9rem;margin-bottom:20px;background:var(--card-bg);border:2px solid var(--accent);border-radius:12px;">' +
                '<div style="font-size:1.5rem;margin-bottom:6px;">🔒</div>' +
                '<div style="margin-bottom:10px;">Want to join the conversation?</div>' +
                '<button onclick="if(typeof showUsernamePrompt===\'function\')showUsernamePrompt()" style="padding:10px 24px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;">Create Free Account / Sign In</button>' +
            '</div>';
        }

        // Replies
        html += '<div id="forumReplies"><div style="text-align:center;padding:20px;color:var(--text-muted);font-size:0.85rem;">Loading replies...</div></div>';

        html += '</div>';
        fc.innerHTML = html;
        document.getElementById('main').scrollTop = 0;

        // Load replies
        forumLoadReplies(postId);
    } catch(e) {
        fc.innerHTML = '<div style="max-width:700px;margin:0 auto;padding:40px 16px;text-align:center;color:#ef4444;">Error loading post</div>';
    }
};

// ---- Load Replies ----
async function forumLoadReplies(postId) {
    var container = document.getElementById('forumReplies');
    if (!container) return;

    try {
        var snap = await db.collection('forum_replies').where('postId', '==', postId).orderBy('createdAt', 'asc').limit(100).get();
        var replies = [];
        snap.forEach(function(doc) { replies.push({ id: doc.id, ...doc.data() }); });

        if (replies.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-faint);font-size:0.85rem;">No replies yet. Be the first!</div>';
            return;
        }

        var html = '<div style="font-size:0.8rem;color:var(--text-faint);margin-bottom:12px;">' + replies.length + ' ' + (replies.length === 1 ? 'reply' : 'replies') + '</div>';
        replies.forEach(function(r) {
            var rlv = typeof getLevel === 'function' ? getLevel(r.authorPoints || 0) : { emoji: '🟢' };
            var hasVotedR = r.voters && auth && auth.currentUser && r.voters.indexOf(auth.currentUser.uid) !== -1;
            var bodyHtml = fEsc(r.body).replace(/\n/g, '<br>');
            bodyHtml = bodyHtml.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:var(--accent);">$1</a>');

            var canDeleteReply = (auth && auth.currentUser && r.authorId === auth.currentUser.uid) || isForumAdmin();
            html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px;word-wrap:break-word;overflow-wrap:break-word;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
                    '<span style="font-size:0.8rem;color:var(--text-muted);cursor:pointer;transition:0.2s;" onclick="if(typeof showUserProfile===\'function\')showUserProfile(\'' + r.authorId + '\')" onmouseover="this.style.color=\'var(--accent)\'" onmouseout="this.style.color=\'var(--text-muted)\'">' + rlv.emoji + ' ' + fEsc(r.authorName || 'Anon') + '</span>' +
                    '<span style="font-size:0.7rem;color:var(--text-faint);">' + timeAgo(r.createdAt) + '</span>' +
                '</div>' +
                '<div style="color:var(--text);font-size:0.85rem;line-height:1.5;margin-bottom:8px;">' + bodyHtml + '</div>' +
                '<div style="display:flex;gap:8px;align-items:center;">' +
                    '<button onclick="forumVoteReply(\'' + r.id + '\')" style="display:flex;align-items:center;gap:4px;background:' + (hasVotedR ? 'var(--accent-bg)' : 'none') + ';border:1px solid ' + (hasVotedR ? 'var(--accent)' : 'var(--border)') + ';border-radius:12px;padding:3px 10px;cursor:pointer;color:' + (hasVotedR ? 'var(--accent)' : 'var(--text-faint)') + ';font-size:0.75rem;font-family:inherit;touch-action:manipulation;">⚡ ' + (r.upvotes || 0) + '</button>' +
                    (canDeleteReply ? '<button onclick="forumDeleteReply(\'' + r.id + '\',\'' + r.postId + '\')" style="background:none;border:none;color:var(--text-faint);font-size:0.7rem;cursor:pointer;padding:2px;touch-action:manipulation;opacity:0.5;" title="Delete reply">🗑️</button>' : '') +
                '</div>' +
            '</div>';
        });

        container.innerHTML = html;
    } catch(e) {
        container.innerHTML = '<div style="color:#ef4444;font-size:0.85rem;">Error loading replies</div>';
    }
}

// ---- New Post Form ----
window.forumNewPost = function() {
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        var _fc = document.getElementById('forumContainer');
        if (_fc) {
            _fc.innerHTML = '<div style="max-width:700px;margin:0 auto;padding:20px 16px;">' +
                '<button onclick="forumBack()" style="background:none;border:none;color:var(--text-muted);font-size:0.85rem;cursor:pointer;padding:0;margin-bottom:16px;font-family:inherit;">← Back to PlebTalk</button>' +
                '<div style="text-align:center;padding:40px 20px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;">' +
                    '<div style="font-size:3rem;margin-bottom:12px;">🔒</div>' +
                    '<h2 style="color:var(--heading);font-size:1.2rem;margin:0 0 8px;">Registration Required</h2>' +
                    '<div style="color:var(--text-muted);font-size:0.9rem;margin-bottom:20px;max-width:360px;margin-left:auto;margin-right:auto;">Create a free account to post in the forum, join discussions, and earn points! It only takes a few seconds.</div>' +
                    '<button onclick="if(typeof showUsernamePrompt===\'function\')showUsernamePrompt()" style="padding:12px 28px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;">Create Free Account / Sign In</button>' +
                '</div></div>';
        }
        return;
    }

    history.pushState({ channel: 'forum-new' }, '', '#forum');
    var fc = document.getElementById('forumContainer');
    
    
    if (!fc) return;
    
    

    var html = '<div style="max-width:700px;margin:0 auto;padding:16px 12px;">';
    html += '<button onclick="forumBack()" style="background:none;border:none;color:var(--text-muted);font-size:0.85rem;cursor:pointer;padding:8px 0;margin-bottom:8px;font-family:inherit;touch-action:manipulation;">← Back to PlebTalk</button>';

    html += '<h2 style="color:var(--heading);font-size:1.2rem;font-weight:800;margin:0 0 14px;">📝 Create New Post</h2>';

    html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;">';

    var _inputStyle = 'width:100%;padding:12px;background:var(--input-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:16px;font-family:inherit;outline:none;box-sizing:border-box;margin-bottom:12px;-webkit-appearance:none;';

    // Category
    html += '<label style="color:var(--text-muted);font-size:0.8rem;display:block;margin-bottom:4px;">Category</label>' +
        '<select id="forumNewCat" style="' + _inputStyle + 'cursor:pointer;">';
    FORUM_CATEGORIES.forEach(function(c) {
        html += '<option value="' + c.id + '">' + c.emoji + ' ' + c.name + '</option>';
    });
    html += '</select>';

    // Title
    html += '<label style="color:var(--text-muted);font-size:0.8rem;display:block;margin-bottom:4px;">Title *</label>' +
        '<input type="text" id="forumNewTitle" maxlength="120" placeholder="What\'s on your mind?" style="' + _inputStyle + '">';

    // Body
    html += '<label style="color:var(--text-muted);font-size:0.8rem;display:block;margin-bottom:4px;">Details <span style="color:var(--text-faint);">(optional, 2000 chars max)</span></label>' +
        '<textarea id="forumNewBody" rows="5" maxlength="2000" placeholder="Share your thoughts, ask a question, start a discussion..." style="' + _inputStyle + 'resize:vertical;min-height:100px;"></textarea>';

    // Link
    html += '<label style="color:var(--text-muted);font-size:0.8rem;display:block;margin-bottom:4px;">Link <span style="color:var(--text-faint);">(optional)</span></label>' +
        '<input type="url" id="forumNewLink" maxlength="200" placeholder="https://..." style="' + _inputStyle + '">';

    // Honeypot field — hidden from humans, bots fill it
    html += '<div style="position:absolute;left:-9999px;"><input type="text" id="forumHoneypot" tabindex="-1" autocomplete="off"></div>';

    html += '<button onclick="forumSubmitPost()" style="width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;touch-action:manipulation;-webkit-tap-highlight-color:rgba(247,147,26,0.3);">Post to Forum</button>';
    html += '<div id="forumPostStatus" style="margin-top:8px;font-size:0.85rem;text-align:center;"></div>';

    html += '</div></div>';
    // Record form open time for anti-bot timing check
    window._forumFormOpenTime = Date.now();
    fc.innerHTML = html;
    document.getElementById('main').scrollTop = 0;
};

// ---- Submit Post ----
window.forumSubmitPost = async function() {
    var status = document.getElementById('forumPostStatus');
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        if (status) status.innerHTML = '<span style="color:#ef4444;">You must be signed in</span>';
        return;
    }

    // Anti-bot: honeypot check
    var honeypot = document.getElementById('forumHoneypot');
    if (honeypot && honeypot.value) {
        if (status) status.innerHTML = '<span style="color:#ef4444;">Something went wrong. Please try again.</span>';
        return;
    }

    // Anti-bot: timing check — must spend at least 5 seconds on form
    if (window._forumFormOpenTime && (Date.now() - window._forumFormOpenTime) < 5000) {
        if (status) status.innerHTML = '<span style="color:#ef4444;">Please take a moment to write your post.</span>';
        return;
    }

    var title = (document.getElementById('forumNewTitle').value || '').trim();
    var body = (document.getElementById('forumNewBody').value || '').trim();
    var link = (document.getElementById('forumNewLink').value || '').trim();
    var category = document.getElementById('forumNewCat').value;

    if (!title || title.length < 5) {
        if (status) status.innerHTML = '<span style="color:#ef4444;">Title must be at least 5 characters</span>';
        return;
    }

    if (!isCleanText(title) || (body && !isCleanText(body))) {
        if (status) status.innerHTML = '<span style="color:#ef4444;">Post contains inappropriate language. Keep it clean!</span>';
        return;
    }

    if (link && !/^https?:\/\//i.test(link)) link = 'https://' + link;

    // Rate limit: max 5 posts per day
    var postCount = parseInt(localStorage.getItem('btc_forum_post_count') || '0');
    var postDate = localStorage.getItem('btc_forum_post_date') || '';
    var today = new Date().toISOString().split('T')[0];
    if (postDate !== today) { postCount = 0; }
    if (postCount >= 5) {
        if (status) status.innerHTML = '<span style="color:#ef4444;">You\'ve reached the daily post limit (5). Try again tomorrow!</span>';
        return;
    }

    if (status) status.innerHTML = '<span style="color:var(--text-muted);">Posting...</span>';

    try {
        var userName = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'Anon';
        var userPts = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.points || 0 : 0;

        await db.collection('forum_posts').add({
            title: title,
            body: body.substring(0, 2000),
            link: link.substring(0, 200) || null,
            category: category,
            authorId: auth.currentUser.uid,
            authorName: userName,
            authorPoints: userPts,
            upvotes: 0,
            voters: [],
            replyCount: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        localStorage.setItem('btc_forum_post_count', (postCount + 1).toString());
        localStorage.setItem('btc_forum_post_date', today);

        if (typeof awardPoints === 'function') awardPoints(10, '📝 Forum post');
        // Track for badge
        db.collection('users').doc(auth.currentUser.uid).update({
            forumPosts: firebase.firestore.FieldValue.increment(1)
        }).catch(function(){});
        if (typeof currentUser !== 'undefined' && currentUser) currentUser.forumPosts = (currentUser.forumPosts || 0) + 1;
        forumBack();
    } catch(e) {
        if (status) status.innerHTML = '<span style="color:#ef4444;">Error posting. Try again.</span>';
    }
};

// ---- Submit Reply ----
window.forumSubmitReply = async function(postId) {
    var status = document.getElementById('forumReplyStatus');
    var input = document.getElementById('forumReplyInput');
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous || !input) return;

    var body = input.value.trim();
    if (!body || body.length < 2) {
        if (status) status.innerHTML = '<span style="color:#ef4444;">Reply is too short</span>';
        return;
    }
    if (!isCleanText(body)) {
        if (status) status.innerHTML = '<span style="color:#ef4444;">Reply contains inappropriate language</span>';
        return;
    }

    if (status) status.innerHTML = '<span style="color:var(--text-muted);">Posting...</span>';

    try {
        var userName = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'Anon';
        var userPts = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.points || 0 : 0;

        await db.collection('forum_replies').add({
            postId: postId,
            body: body.substring(0, 1000),
            authorId: auth.currentUser.uid,
            authorName: userName,
            authorPoints: userPts,
            upvotes: 0,
            voters: [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Increment reply count
        await db.collection('forum_posts').doc(postId).update({
            replyCount: firebase.firestore.FieldValue.increment(1)
        });

        if (typeof awardPoints === 'function') awardPoints(5, '💬 Forum reply');
        // Track for badge
        db.collection('users').doc(auth.currentUser.uid).update({
            forumReplies: firebase.firestore.FieldValue.increment(1)
        }).catch(function(){});
        if (typeof currentUser !== 'undefined' && currentUser) currentUser.forumReplies = (currentUser.forumReplies || 0) + 1;
        input.value = '';
        if (status) status.innerHTML = '<span style="color:#22c55e;">✅ Reply posted!</span>';
        forumLoadReplies(postId);
    } catch(e) {
        if (status) status.innerHTML = '<span style="color:#ef4444;">Error posting reply</span>';
    }
};

// ---- Vote Post ----
window.forumVotePost = async function(postId) {
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        if (typeof showToast === 'function') showToast('🔒 Sign in to upvote!');
        if (typeof showUsernamePrompt === 'function') showUsernamePrompt();
        return;
    }

    try {
        var ref = db.collection('forum_posts').doc(postId);
        var doc = await ref.get();
        if (!doc.exists) return;
        var voters = doc.data().voters || [];
        var uid = auth.currentUser.uid;

        if (voters.indexOf(uid) !== -1) {
            // Already voted — remove vote
            await ref.update({
                upvotes: firebase.firestore.FieldValue.increment(-1),
                voters: firebase.firestore.FieldValue.arrayRemove(uid)
            });
        } else {
            await ref.update({
                upvotes: firebase.firestore.FieldValue.increment(1),
                voters: firebase.firestore.FieldValue.arrayUnion(uid)
            });
        }

        // Refresh
        if (forumCurrentPost && forumCurrentPost.id === postId) {
            forumViewPost(postId);
        } else {
            forumLoadPosts();
        }
    } catch(e) {}
};

// ---- Vote Reply ----
window.forumVoteReply = async function(replyId) {
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        if (typeof showToast === 'function') showToast('🔒 Sign in to upvote!');
        if (typeof showUsernamePrompt === 'function') showUsernamePrompt();
        return;
    }

    try {
        var ref = db.collection('forum_replies').doc(replyId);
        var doc = await ref.get();
        if (!doc.exists) return;
        var voters = doc.data().voters || [];
        var uid = auth.currentUser.uid;

        if (voters.indexOf(uid) !== -1) {
            await ref.update({
                upvotes: firebase.firestore.FieldValue.increment(-1),
                voters: firebase.firestore.FieldValue.arrayRemove(uid)
            });
        } else {
            await ref.update({
                upvotes: firebase.firestore.FieldValue.increment(1),
                voters: firebase.firestore.FieldValue.arrayUnion(uid)
            });
        }

        if (forumCurrentPost) forumLoadReplies(forumCurrentPost.id);
    } catch(e) {}
};

// ---- Delete Post (author or admin) ----
window.forumDeletePost = async function(postId) {
    if (!auth || !auth.currentUser) return;
    var isAdmin = isForumAdmin();

    if (!confirm(isAdmin ? 'Admin: Delete this post and all its replies?' : 'Delete your post? This cannot be undone.')) return;

    try {
        // Delete all replies first
        var repliesSnap = await db.collection('forum_replies').where('postId', '==', postId).get();
        var batch = db.batch();
        repliesSnap.forEach(function(doc) { batch.delete(doc.ref); });
        batch.delete(db.collection('forum_posts').doc(postId));
        await batch.commit();

        if (typeof showToast === 'function') showToast('🗑️ Post deleted');
        forumBack();
    } catch(e) {
        if (typeof showToast === 'function') showToast('Error deleting post');
    }
};

// ---- Delete Reply (author or admin) ----
window.forumDeleteReply = async function(replyId, postId) {
    if (!auth || !auth.currentUser) return;
    var isAdmin = isForumAdmin();

    if (!confirm(isAdmin ? 'Admin: Delete this reply?' : 'Delete your reply? This cannot be undone.')) return;

    try {
        await db.collection('forum_replies').doc(replyId).delete();
        // Decrement reply count
        await db.collection('forum_posts').doc(postId).update({
            replyCount: firebase.firestore.FieldValue.increment(-1)
        });

        if (typeof showToast === 'function') showToast('🗑️ Reply deleted');
        if (forumCurrentPost) forumLoadReplies(postId);
    } catch(e) {
        if (typeof showToast === 'function') showToast('Error deleting reply');
    }
};

})();
