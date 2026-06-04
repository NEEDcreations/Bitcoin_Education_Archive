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
    return email === 'needcreations@gmail.com' || email === 'info.603btc@gmail.com';
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
    var html = '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if(event.target===this){acceptForumRules()}">' +
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
// [AUDIT FIX] timeAgo moved to utils.js

// Navigate back to forum list
window.forumBack = function() {
    history.back();
};

// State
var forumSort = 'recent';
var forumCategory = sessionStorage.getItem('btc_forum_category') || 'all';
var forumPage = 'list'; // list | post | new
var forumCurrentPost = null;
var forumPostsCache = [];
var forumLastLoad = 0;
var forumTab = 'discussions'; // discussions | articles | stacker

// Article tags
var ARTICLE_TAGS = [
    'Bitcoin Basics', 'Lightning', 'Mining', 'Privacy', 'Self-Custody',
    'Economics', 'Technical', 'Culture', 'Opinion', 'Tutorial', 'News Analysis'
];

// ---- Render Forum ----
window.renderForum = function() {
    var fc = document.getElementById('forumContainer');
    
    
    if (!fc) return;
    
    
    fc.innerHTML = '';

    var html = '<div style="max-width:700px;margin:0 auto;padding:16px 12px;">';
    html += '<div class="channel-logos" style="display:flex;justify-content:center;gap:20px;margin-bottom:20px;">' + 
        '<img src="images/btc-grad-logo-sm.jpg" alt="Home" class="channel-logo-img" onclick="goHome()" style="width:50px;height:50px;border-radius:50%;cursor:pointer;box-shadow:0 0 15px rgba(247,147,26,0.3);object-fit:cover;" title="Home">' + 
        '<span class="donate-circle" onclick="showDonateModal()" style="width:50px;height:50px;background:#f7931a;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 0 15px rgba(247,147,26,0.3);"><svg viewBox="0 0 64 64" width="32" height="32"><polygon points="36,10 22,38 30,38 28,54 42,26 34,26" fill="#fff"/></svg></span>' + 
        '</div>';

    // Header
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:10px;">' +
        '<div style="min-width:0;">' +
            '<h2 style="color:var(--heading);font-size:1.3rem;font-weight:800;margin:0;">🗣️ Pleb Talk</h2>' +
            '<div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px;">Discuss Bitcoin with fellow learners</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-shrink:0;">' +
            '<button onclick="showForumRulesBtn()" style="padding:10px 14px;background:none;border:1px solid var(--border);color:var(--text-muted);border-radius:10px;font-size:0.85rem;cursor:pointer;font-family:inherit;touch-action:manipulation;white-space:nowrap;">📜 Rules</button>' +
            '<button onclick="forumNewPost()" style="padding:10px 18px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;touch-action:manipulation;white-space:nowrap;">+ New Post</button>' +
        '</div>' +
    '</div>';

    // Tab switcher
    html += '<div style="display:flex;gap:0;margin-bottom:16px;border:1px solid var(--border);border-radius:10px;overflow:hidden;">' +
        '<button onclick="forumSwitchTab(\'discussions\')" style="flex:1;padding:10px;background:' + (forumTab === 'discussions' ? 'var(--accent)' : 'none') + ';color:' + (forumTab === 'discussions' ? '#fff' : 'var(--text-muted)') + ';border:none;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">💬 Discussions</button>' +
        '<button onclick="forumSwitchTab(\'articles\')" style="flex:1;padding:10px;background:' + (forumTab === 'articles' ? 'var(--accent)' : 'none') + ';color:' + (forumTab === 'articles' ? '#fff' : 'var(--text-muted)') + ';border:none;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">📝 Articles</button>' +
        '<button onclick="forumSwitchTab(\'stacker\')" style="flex:1;padding:10px;background:' + (forumTab === 'stacker' ? 'var(--accent)' : 'none') + ';color:' + (forumTab === 'stacker' ? '#fff' : 'var(--text-muted)') + ';border:none;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">⚡ Stacker News</button>' +
    '</div>';

    if (forumTab === 'stacker') {
        // Search bar
        var snSearchQuery = window._snSearchQuery || '';
        html += '<div style="display:flex;gap:8px;margin-bottom:12px;">';
        html += '<input id="snSearchInput" type="text" placeholder="Search Stacker News..." value="' + snEscape(snSearchQuery) + '" onkeydown="if(event.key===\'Enter\')snDoSearch()" style="flex:1;padding:10px 14px;border-radius:10px;border:1px solid var(--border);background:var(--card-bg);color:var(--text);font-size:0.85rem;font-family:inherit;outline:none;" />';
        html += '<button onclick="snDoSearch()" style="padding:10px 16px;border-radius:10px;border:none;background:var(--accent);color:#fff;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;">🔍</button>';
        if (snSearchQuery) {
            html += '<button onclick="snClearSearch()" style="padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:var(--card-bg);color:var(--text-muted);font-size:0.85rem;cursor:pointer;font-family:inherit;">✕</button>';
        }
        html += '</div>';

        // Territory filters
        var snSub = window._snSub || '';
        var snTerritories = [{id:'',label:'All'},{id:'bitcoin',label:'bitcoin'},{id:'lightning',label:'lightning'},{id:'nostr',label:'nostr'},{id:'privacy',label:'privacy'},{id:'tech',label:'tech'},{id:'meta',label:'meta'}];
        html += '<div style="display:flex;gap:6px;margin-bottom:12px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;">';
        for (var ti = 0; ti < snTerritories.length; ti++) {
            var t = snTerritories[ti];
            var isActive = snSub === t.id;
            html += '<button onclick="window._snSub=\'' + t.id + '\';window._snSearchQuery=\'\';renderForum()" style="padding:5px 12px;border-radius:16px;border:1px solid ' + (isActive ? 'var(--accent)' : 'var(--border)') + ';background:' + (isActive ? 'rgba(247,147,26,0.15)' : 'var(--card-bg)') + ';color:' + (isActive ? 'var(--accent)' : 'var(--text-muted)') + ';font-size:0.7rem;cursor:pointer;font-family:inherit;font-weight:600;white-space:nowrap;">' + snEscape(t.label) + '</button>';
        }
        html += '</div>';

        // Sort selector (hide when searching)
        if (!snSearchQuery) {
            var snSort = window._snSort || 'top';
            var snWhen = window._snWhen || 'day';
            html += '<div style="display:flex;gap:8px;margin-bottom:14px;align-items:center;flex-wrap:wrap;">';
            // Sort pills
            var snSorts = [{id:'top',label:'🔥 Top'},{id:'recent',label:'🕐 Recent'},{id:'random',label:'🎲 Random'}];
            for (var ss = 0; ss < snSorts.length; ss++) {
                var s = snSorts[ss];
                html += '<button onclick="window._snSort=\'' + s.id + '\';renderForum()" style="padding:6px 14px;border-radius:20px;border:1px solid ' + (snSort === s.id ? 'var(--accent)' : 'var(--border)') + ';background:' + (snSort === s.id ? 'var(--accent)' : 'var(--card-bg)') + ';color:' + (snSort === s.id ? '#fff' : 'var(--text-muted)') + ';font-size:0.75rem;cursor:pointer;font-family:inherit;font-weight:600;">' + s.label + '</button>';
            }
            // Time range (only for top)
            if (snSort === 'top') {
                html += '<select onchange="window._snWhen=this.value;renderForum()" style="padding:6px 10px;border-radius:10px;border:1px solid var(--border);background:var(--card-bg);color:var(--text);font-size:0.75rem;font-family:inherit;">';
                var whens = [{id:'day',label:'Today'},{id:'week',label:'This Week'},{id:'month',label:'This Month'},{id:'year',label:'This Year'}];
                for (var wi = 0; wi < whens.length; wi++) {
                    html += '<option value="' + whens[wi].id + '"' + (snWhen === whens[wi].id ? ' selected' : '') + '>' + whens[wi].label + '</option>';
                }
                html += '</select>';
            }
            html += '<a href="https://stacker.news" target="_blank" rel="noopener noreferrer" style="margin-left:auto;color:var(--text-muted);font-size:0.7rem;text-decoration:none;">stacker.news ↗</a>';
            html += '</div>';
        } else {
            html += '<div style="margin-bottom:14px;font-size:0.8rem;color:var(--text-muted);">Search results for: <strong style="color:var(--text);">' + snEscape(snSearchQuery) + '</strong></div>';
        }

        // Feed container
        html += '<div id="snFeed" style="min-height:200px;"><div style="text-align:center;padding:40px 0;color:var(--text-muted);">Loading Stacker News...</div></div>';
        html += '</div>';
        fc.innerHTML = html;
        if (snSearchQuery) {
            snSearchFeed(snSearchQuery);
        } else {
            loadStackerNewsFeed(window._snSort || 'top', window._snWhen || 'day', snSub);
        }
        return;
    }

    if (forumTab === 'articles') {
        renderArticlesList(html, fc);
        return;
    }

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
// Forum post loading — cached one-time .get() (saves thousands of reads/day vs onSnapshot)
window._forumUnsubscribe = null; // kept for compat

window.forumLoadPosts = async function() {
    var container = document.getElementById('forumPosts');
    if (!container || typeof db === 'undefined') return;

    // Unsubscribe any legacy listener
    if (window._forumUnsubscribe) {
        window._forumUnsubscribe();
        window._forumUnsubscribe = null;
    }

    // Use cached .get() with 2-min TTL
    forumLoadPostsFallback();
};

// Fallback: one-time read if real-time listener fails
async function forumLoadPostsFallback() {
    var container = document.getElementById('forumPosts');
    if (!container) return;
    try {
        var sortField = forumSort === 'top' ? 'upvotes' : forumSort === 'discussed' ? 'replyCount' : 'createdAt';
        // Cache forum posts for 2 minutes to save Firestore reads
        var _forumKey = forumCategory + '_' + forumSort;
        var _forumNow = Date.now();
        if (window._forumCache && window._forumCache.key === _forumKey && (_forumNow - window._forumCache.time < 120000)) {
            forumPostsCache = window._forumCache.posts;
            forumRenderPosts(window._forumCache.posts, container);
            return;
        }
        var query = forumCategory !== 'all'
            ? db.collection('forum_posts').where('category', '==', forumCategory).orderBy(sortField, 'desc').limit(50)
            : db.collection('forum_posts').orderBy(sortField, 'desc').limit(50);
        var snap = await query.get();
        var posts = [];
        snap.forEach(function(doc) { posts.push({ id: doc.id, ...doc.data() }); });
        forumPostsCache = posts;
        window._forumCache = { key: _forumKey, time: Date.now(), posts: posts };
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
                    '<button onclick="event.stopPropagation();forumVotePost(\'' + p.id + '\')" style="background:none;border:none;cursor:pointer;font-size:1.2rem;padding:4px;color:' + (hasVoted ? 'var(--accent)' : 'var(--text-faint)') + ';touch-action:manipulation;" title="Upvote">👍</button>' +
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
window.forumSetCategory = function(c) { forumCategory = c; sessionStorage.setItem('btc_forum_category', c); renderForum(); };

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
    html += '<div class="channel-logos" style="display:flex;justify-content:center;gap:20px;margin-bottom:20px;">' + 
        '<img src="images/btc-grad-logo-sm.jpg" alt="Home" class="channel-logo-img" onclick="goHome()" style="width:50px;height:50px;border-radius:50%;cursor:pointer;box-shadow:0 0 15px rgba(247,147,26,0.3);object-fit:cover;" title="Home">' + 
        '<span class="donate-circle" onclick="showDonateModal()" style="width:50px;height:50px;background:#f7931a;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 0 15px rgba(247,147,26,0.3);"><svg viewBox="0 0 64 64" width="32" height="32"><polygon points="36,10 22,38 30,38 28,54 42,26 34,26" fill="#fff"/></svg></span>' + 
        '</div>';

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
            bodyHtml = forumRenderMentions(bodyHtml);
            html += '<div style="color:var(--text);font-size:0.9rem;line-height:1.6;margin-bottom:12px;word-wrap:break-word;overflow-wrap:break-word;">' + bodyHtml + '</div>';
        }

        if (p.link) {
            html += '<a href="' + fEsc(p.link) + '" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;color:var(--accent);font-size:0.85rem;margin-bottom:12px;">🔗 ' + fEsc(p.link).substring(0, 60) + (p.link.length > 60 ? '...' : '') + '</a><br>';
        }

        // Vote + meta + admin delete
        var canDeletePost = (auth && auth.currentUser && p.authorId === auth.currentUser.uid) || isForumAdmin();
        html += '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' +
            '<button onclick="forumVotePost(\'' + p.id + '\')" style="display:flex;align-items:center;gap:4px;background:' + (hasVoted ? 'var(--accent-bg)' : 'none') + ';border:1px solid ' + (hasVoted ? 'var(--accent)' : 'var(--border)') + ';border-radius:16px;padding:6px 12px;cursor:pointer;color:' + (hasVoted ? 'var(--accent)' : 'var(--text-muted)') + ';font-size:0.8rem;font-weight:600;font-family:inherit;touch-action:manipulation;">👍 ' + (p.upvotes || 0) + '</button>' +
            '<span style="color:var(--text-faint);font-size:0.8rem;">💬 ' + (p.replyCount || 0) + ' replies</span>' +
            (canDeletePost ? '<button onclick="forumDeletePost(\'' + p.id + '\')" style="background:none;border:1px solid var(--border);border-radius:16px;padding:4px 10px;color:#ef4444;font-size:0.75rem;cursor:pointer;font-family:inherit;touch-action:manipulation;">🗑️ Delete</button>' : '') +
        '</div>';
        html += '</div>';

        // Reply box
        if (auth && auth.currentUser && !auth.currentUser.isAnonymous) {
            html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:16px;">' +
                '<div id="forumReplyIndicator" style="display:none;align-items:center;gap:8px;padding:8px 12px;background:var(--accent-bg);border:1px solid var(--accent);border-radius:8px;margin-bottom:8px;">' +
                    '<span style="font-size:0.8rem;color:var(--accent);font-weight:600;flex:1;"></span>' +
                    '<button onclick="window.forumCancelReplyTo()" style="background:none;border:none;color:var(--text-faint);font-size:1rem;cursor:pointer;padding:2px 4px;line-height:1;touch-action:manipulation;" title="Cancel reply">\u2715</button>' +
                '</div>' +
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

        // Build a threaded view: top-level replies with their children nested below
        var topLevel = [];
        var childMap = {}; // parentReplyId -> [replies]
        replies.forEach(function(r) {
            if (r.parentReplyId) {
                if (!childMap[r.parentReplyId]) childMap[r.parentReplyId] = [];
                childMap[r.parentReplyId].push(r);
            } else {
                topLevel.push(r);
            }
        });

        var html = '<div style="font-size:0.8rem;color:var(--text-faint);margin-bottom:12px;">' + replies.length + ' ' + (replies.length === 1 ? 'reply' : 'replies') + '</div>';

        function _renderReplyCard(r, isNested) {
            var rlv = typeof getLevel === 'function' ? getLevel(r.authorPoints || 0) : { emoji: '\uD83D\uDFE2' };
            var hasVotedR = r.voters && auth && auth.currentUser && r.voters.indexOf(auth.currentUser.uid) !== -1;
            var bodyHtml = fEsc(r.body).replace(/\n/g, '<br>');
            bodyHtml = bodyHtml.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:var(--accent);">$1</a>');
            bodyHtml = forumRenderMentions(bodyHtml);
            var canDeleteReply = (auth && auth.currentUser && r.authorId === auth.currentUser.uid) || isForumAdmin();
            var canReply = auth && auth.currentUser && !auth.currentUser.isAnonymous;
            var replyToLabel = r.parentAuthorName ? '<div style="font-size:0.7rem;color:var(--accent);margin-bottom:4px;">\u21A9 ' + fEsc(r.parentAuthorName) + '</div>' : '';
            var indent = isNested ? 'margin-left:24px;border-left:2px solid var(--accent);' : '';
            var out = '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px;word-wrap:break-word;overflow-wrap:break-word;' + indent + '">' +
                replyToLabel +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
                    '<span style="font-size:0.8rem;color:var(--text-muted);cursor:pointer;transition:0.2s;" onclick="if(typeof showUserProfile===\'function\')showUserProfile(\'' + r.authorId + '\')" onmouseover="this.style.color=\'var(--accent)\'" onmouseout="this.style.color=\'var(--text-muted)\'">' + rlv.emoji + ' ' + fEsc(r.authorName || 'Anon') + '</span>' +
                    '<span style="font-size:0.7rem;color:var(--text-faint);">' + timeAgo(r.createdAt) + '</span>' +
                '</div>' +
                '<div style="color:var(--text);font-size:0.85rem;line-height:1.5;margin-bottom:8px;">' + bodyHtml + '</div>' +
                '<div style="display:flex;gap:8px;align-items:center;">' +
                    '<button onclick="forumVoteReply(\'' + r.id + '\')" style="display:flex;align-items:center;gap:4px;background:' + (hasVotedR ? 'var(--accent-bg)' : 'none') + ';border:1px solid ' + (hasVotedR ? 'var(--accent)' : 'var(--border)') + ';border-radius:12px;padding:3px 10px;cursor:pointer;color:' + (hasVotedR ? 'var(--accent)' : 'var(--text-faint)') + ';font-size:0.75rem;font-family:inherit;touch-action:manipulation;">\uD83D\uDC4D ' + (r.upvotes || 0) + '</button>' +
                    (canReply ? '<button data-reply-id="' + r.id + '" data-reply-author="' + fEsc(r.authorName || 'Anon') + '" onclick="window.forumReplyToReply(this.dataset.replyId,this.dataset.replyAuthor)" style="display:flex;align-items:center;gap:4px;background:none;border:1px solid var(--border);border-radius:12px;padding:3px 10px;cursor:pointer;color:var(--text-faint);font-size:0.75rem;font-family:inherit;touch-action:manipulation;">\u21A9 Reply</button>' : '') +
                    (canDeleteReply ? '<button onclick="forumDeleteReply(\'' + r.id + '\',\'' + r.postId + '\')" style="background:none;border:none;color:var(--text-faint);font-size:0.7rem;cursor:pointer;padding:2px;touch-action:manipulation;opacity:0.5;" title="Delete reply">\uD83D\uDDD1\uFE0F</button>' : '') +
                '</div>' +
            '</div>';
            return out;
        }

        topLevel.forEach(function(r) {
            html += _renderReplyCard(r, false);
            // Render children (one level deep)
            var children = childMap[r.id] || [];
            children.forEach(function(child) {
                html += _renderReplyCard(child, true);
            });
        });

        // Render orphaned nested replies whose parent was deleted (show as top-level)
        Object.keys(childMap).forEach(function(parentId) {
            var parentExists = topLevel.some(function(t) { return t.id === parentId; });
            if (!parentExists) {
                childMap[parentId].forEach(function(orphan) {
                    html += _renderReplyCard(orphan, false);
                });
            }
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
                    '<div style="color:var(--text-muted);font-size:0.9rem;margin-bottom:20px;max-width:360px;margin-left:auto;margin-right:auto;">Create a free account to post in the forum, join discussions, and earn XP! It only takes a few seconds.</div>' +
                    '<button onclick="if(typeof showUsernamePrompt===\'function\')showUsernamePrompt()" style="padding:12px 28px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;">Create Free Account / Sign In</button>' +
                '</div></div>';
        }
        return;
    }

    history.pushState({ channel: 'forum-new' }, '', '#forum');
    var fc = document.getElementById('forumContainer');
    
    
    if (!fc) return;
    
    

    var html = '<div style="max-width:700px;margin:0 auto;padding:16px 12px;">';
    html += '<div class="channel-logos" style="display:flex;justify-content:center;gap:20px;margin-bottom:20px;">' + 
        '<img src="images/btc-grad-logo-sm.jpg" alt="Home" class="channel-logo-img" onclick="goHome()" style="width:50px;height:50px;border-radius:50%;cursor:pointer;box-shadow:0 0 15px rgba(247,147,26,0.3);object-fit:cover;" title="Home">' + 
        '<span class="donate-circle" onclick="showDonateModal()" style="width:50px;height:50px;background:#f7931a;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 0 15px rgba(247,147,26,0.3);"><svg viewBox="0 0 64 64" width="32" height="32"><polygon points="36,10 22,38 30,38 28,54 42,26 34,26" fill="#fff"/></svg></span>' + 
        '</div>';
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
var _lastForumPostTime = 0;
window.forumSubmitPost = async function() {
    // [AUDIT FIX] Double-submit protection
    if (window._forumSubmitting) return;
    // [AUDIT FIX M1] Rate limit: 30s between posts
    var _now = Date.now();
    if (_now - _lastForumPostTime < 30000) {
        if (typeof showToast === 'function') showToast('⏳ Wait 30 seconds between posts');
        return;
    }
    _lastForumPostTime = _now;
    window._forumSubmitting = true;
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
    // [AUDIT FIX L2] Sanitize all user input
    if (typeof sanitizeInput === 'function') { title = sanitizeInput(title); body = sanitizeInput(body); }

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

        var postRef = await db.collection('forum_posts').add({
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
        if (typeof awardTickets === 'function') awardTickets(5, '📝 Forum post');
        // Notify @mentioned users
        forumNotifyMentions(body, 'forum_post', postRef.id, title);
        // Track for badge
        db.collection('users').doc(auth.currentUser.uid).update({
            forumPosts: firebase.firestore.FieldValue.increment(1)
        }).catch(function(e) { console.error('[forum] Error:', e); });
        if (typeof currentUser !== 'undefined' && currentUser) currentUser.forumPosts = (currentUser.forumPosts || 0) + 1;
        // Raid Boss: forum post
        if (typeof window._raidOnForumPost === 'function') window._raidOnForumPost();
        forumBack();
    } catch(e) {
        if (status) status.innerHTML = '<span style="color:#ef4444;">Error posting. Try again.</span>';
    }
};

// ---- Reply to Reply ----
window._forumReplyingTo = null; // { replyId, authorName }

window.forumReplyToReply = function(replyId, authorName) {
    window._forumReplyingTo = { replyId: replyId, authorName: authorName };
    var indicator = document.getElementById('forumReplyIndicator');
    if (indicator) {
        indicator.style.display = 'flex';
        indicator.querySelector('span').textContent = '\u21A9 Replying to ' + authorName;
    }
    var input = document.getElementById('forumReplyInput');
    if (input) { input.focus(); input.placeholder = 'Reply to ' + authorName + '...'; }
};

window.forumCancelReplyTo = function() {
    window._forumReplyingTo = null;
    var indicator = document.getElementById('forumReplyIndicator');
    if (indicator) indicator.style.display = 'none';
    var input = document.getElementById('forumReplyInput');
    if (input) input.placeholder = 'Write a reply...';
};

// ---- Submit Reply ----
window.forumSubmitReply = async function(postId) {
    // [AUDIT FIX] Double-submit protection
    if (window._forumReplySubmitting) return;
    window._forumReplySubmitting = true;
    var status = document.getElementById('forumReplyStatus');
    var input = document.getElementById('forumReplyInput');
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous || !input) { window._forumReplySubmitting = false; return; }

    var body = input.value.trim();
    if (!body || body.length < 2) {
        if (status) status.innerHTML = '<span style="color:#ef4444;">Reply is too short</span>';
        window._forumReplySubmitting = false; return;
    }
    if (!isCleanText(body)) {
        if (status) status.innerHTML = '<span style="color:#ef4444;">Reply contains inappropriate language</span>';
        window._forumReplySubmitting = false; return;
    }

    if (status) status.innerHTML = '<span style="color:var(--text-muted);">Posting...</span>';

    try {
        var userName = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'Anon';
        var userPts = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.points || 0 : 0;

        var replyData = {
            postId: postId,
            body: body.substring(0, 1000),
            authorId: auth.currentUser.uid,
            authorName: userName,
            authorPoints: userPts,
            upvotes: 0,
            voters: [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Thread support: if replying to another reply, include parent info
        var replyingTo = window._forumReplyingTo;
        if (replyingTo && replyingTo.replyId) {
            replyData.parentReplyId = replyingTo.replyId;
            replyData.parentAuthorName = replyingTo.authorName || '';
        }

        await db.collection('forum_replies').add(replyData);

        // Increment reply count
        await db.collection('forum_posts').doc(postId).update({
            replyCount: firebase.firestore.FieldValue.increment(1)
        });

        if (typeof awardPoints === 'function') awardPoints(5, '\uD83D\uDCAC Forum reply');
        // Notify post author (for top-level replies) or parent reply author (for nested)
        var _un = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'Someone';
        if (replyingTo && replyingTo.replyId) {
            // Notify the person being replied to (look up their reply doc)
            try {
                var parentReplyDoc = await db.collection('forum_replies').doc(replyingTo.replyId).get();
                if (parentReplyDoc.exists && parentReplyDoc.data().authorId && typeof sendNotification === 'function') {
                    sendNotification(parentReplyDoc.data().authorId, 'reply', _un + ' replied to your comment on "' + (forumCurrentPost ? (forumCurrentPost.title || '').substring(0, 40) : 'a post') + '"', 'forum_post', postId);
                }
            } catch(ne) { /* notification failure is non-critical */ }
            // Also notify original post author if different
            if (forumCurrentPost && forumCurrentPost.authorId && typeof sendNotification === 'function') {
                sendNotification(forumCurrentPost.authorId, 'reply', _un + ' replied in your post "' + (forumCurrentPost.title || '').substring(0, 40) + '"', 'forum_post', postId);
            }
        } else if (forumCurrentPost && forumCurrentPost.authorId && typeof sendNotification === 'function') {
            sendNotification(forumCurrentPost.authorId, 'reply', _un + ' replied to your post "' + (forumCurrentPost.title || '').substring(0, 40) + '"', 'forum_post', postId);
        }
        // Notify @mentioned users
        forumNotifyMentions(body, 'forum_post', postId, forumCurrentPost ? forumCurrentPost.title : '');
        // Track for badge
        db.collection('users').doc(auth.currentUser.uid).update({
            forumReplies: firebase.firestore.FieldValue.increment(1)
        }).catch(function(e) { console.error('[forum] Error:', e); });
        if (typeof currentUser !== 'undefined' && currentUser) currentUser.forumReplies = (currentUser.forumReplies || 0) + 1;
        input.value = '';
        // Clear reply-to state
        window.forumCancelReplyTo();
        if (status) status.innerHTML = '<span style="color:#22c55e;">\u2705 Reply posted!</span>';
        forumLoadReplies(postId);
    } catch(e) {
        if (status) status.innerHTML = '<span style="color:#ef4444;">Error posting reply</span>';
    }
    window._forumReplySubmitting = false;
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
            // Notify post author
            var _d = doc.data();
            if (_d.authorId && typeof sendNotification === 'function') {
                var _un = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'Someone';
                sendNotification(_d.authorId, 'upvote', _un + ' upvoted your post "' + (_d.title || '').substring(0, 40) + '"', 'forum_post', postId);
            }
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

// =============================================
// 📝 PlebTalk Articles System
// =============================================
// ---- Tab Switcher ----
window.forumSwitchTab = function(tab) {
    forumTab = tab;
    renderForum();
};

// ---- Simple Markdown to HTML ----
function mdToHtml(md) {
    if (!md) return '';
    var h = fEsc(md);
    // Images: ![alt](url)
    h = h.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:12px;margin:16px 0;display:block;">');
    // Links: [text](url)
    h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline;font-weight:600;">$1</a>');
    // Bare URLs (not already in an href or src)
    h = h.replace(/(?<!href="|src=")(https?:\/\/[^\s<"]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline;">$1</a>');
    h = h.replace(/^### (.+)$/gm, '<h3 style="color:var(--heading);font-size:1.1rem;font-weight:800;margin:20px 0 8px;">$1</h3>');
    h = h.replace(/^## (.+)$/gm, '<h2 style="color:var(--heading);font-size:1.25rem;font-weight:800;margin:24px 0 10px;">$1</h2>');
    h = h.replace(/^# (.+)$/gm, '<h1 style="color:var(--heading);font-size:1.4rem;font-weight:900;margin:28px 0 12px;">$1</h1>');
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--heading);">$1</strong>');
    h = h.replace(/\*(.+?)\*/g, '<em>$1</em>');
    h = h.replace(/`(.+?)`/g, '<code style="background:var(--card-bg);padding:2px 6px;border-radius:4px;font-size:0.9em;">$1</code>');
    h = h.replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid var(--accent);padding:8px 16px;margin:12px 0;color:var(--text-muted);font-style:italic;">$1</blockquote>');
    h = h.replace(/^- (.+)$/gm, '<li style="margin:4px 0 4px 20px;">$1</li>');
    h = h.replace(/^\d+\. (.+)$/gm, '<li style="margin:4px 0 4px 20px;">$1</li>');
    h = h.replace(/---/g, '<hr style="border:none;border-top:1px solid var(--border);margin:20px 0;">');
    h = h.replace(/\n{2,}/g, '</p><p style="margin:12px 0;line-height:1.8;">');
    h = '<p style="margin:12px 0;line-height:1.8;">' + h + '</p>';
    h = forumRenderMentions(h);
    return h;
}

// ---- Articles List View ----
function renderArticlesList(htmlPrefix, fc) {
    var html = htmlPrefix;
    
    // Action buttons
    html += '<div style="display:flex;gap:8px;margin-bottom:16px;justify-content:flex-end;">' +
        '<button onclick="showForumRulesBtn()" style="padding:10px 14px;background:none;border:1px solid var(--border);color:var(--text-muted);border-radius:10px;font-size:0.85rem;cursor:pointer;font-family:inherit;">📜 Rules</button>' +
        '<button onclick="articleNew()" style="padding:10px 18px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">✍️ Write Article</button>' +
    '</div>';
    
    // Sort
    html += '<div style="display:flex;gap:6px;margin-bottom:14px;">';
    ['recent','top'].forEach(function(s) {
        var labels = { recent: '🕐 Recent', top: '🔥 Top' };
        var active = forumSort === s;
        html += '<button onclick="forumSetSort(\'' + s + '\')" style="padding:8px 12px;border-radius:16px;font-size:0.75rem;cursor:pointer;font-family:inherit;border:1px solid ' + (active ? 'var(--accent)' : 'var(--border)') + ';background:' + (active ? 'var(--accent-bg)' : 'none') + ';color:' + (active ? 'var(--accent)' : 'var(--text-muted)') + ';font-weight:' + (active ? '700' : '400') + ';">' + labels[s] + '</button>';
    });
    html += '</div>';
    
    html += '<div id="articlesList"><div style="text-align:center;padding:40px;color:var(--text-muted);">Loading articles...</div></div>';
    html += '</div>';
    fc.innerHTML = html;
    document.getElementById('main').scrollTop = 0;
    loadArticles();
}

// ---- Load Articles from Firestore ----
async function loadArticles() {
    var container = document.getElementById('articlesList');
    if (!container || typeof db === 'undefined') return;
    
    try {
        var sortField = forumSort === 'top' ? 'upvotes' : 'createdAt';
        var snap = await db.collection('articles').where('status', '==', 'published').orderBy(sortField, 'desc').limit(15).get();
        var articles = [];
        snap.forEach(function(doc) { articles.push({ id: doc.id, ...doc.data() }); });
        
        if (articles.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:60px 20px;">' +
                '<div style="font-size:3rem;margin-bottom:12px;">📝</div>' +
                '<div style="color:var(--heading);font-size:1.1rem;font-weight:700;margin-bottom:6px;">No articles yet</div>' +
                '<div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:16px;">Be the first to publish a Bitcoin article!</div>' +
                '<button onclick="articleNew()" style="padding:10px 20px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;">✍️ Write Article</button>' +
            '</div>';
            return;
        }
        
        var html = '';
        articles.forEach(function(a) {
            var lv = typeof getLevel === 'function' ? getLevel(a.authorPoints || 0) : { emoji: '🟢' };
            var readTime = Math.max(1, Math.round((a.wordCount || 500) / 200));
            var dateStr = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().toLocaleDateString() : '';
            var pinned = a.pinned ? '<span style="color:#f7931a;font-size:0.7rem;font-weight:700;">📌 PINNED</span> ' : '';
            
            html += '<div onclick="articleView(\'' + a.id + '\')" style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:0;margin-bottom:12px;cursor:pointer;transition:0.2s;overflow:hidden;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\'">';
            
            if (a.coverUrl) {
                html += '<div style="height:160px;background:url(' + fEsc(a.coverUrl) + ') center/cover no-repeat;"></div>';
            }
            
            html += '<div style="padding:16px;">';
            html += pinned + '<h3 style="color:var(--heading);font-size:1.05rem;font-weight:800;margin:0 0 6px;line-height:1.4;">' + fEsc(a.title) + '</h3>';
            if (a.subtitle) html += '<div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:8px;line-height:1.4;">' + fEsc(a.subtitle) + '</div>';
            
            // Tags
            if (a.tags && a.tags.length) {
                html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">';
                a.tags.forEach(function(t) { html += '<span style="padding:2px 8px;background:var(--accent-bg);border-radius:10px;font-size:0.65rem;color:var(--accent);font-weight:600;">' + fEsc(t) + '</span>'; });
                html += '</div>';
            }
            
            // Meta
            html += '<div style="display:flex;align-items:center;gap:8px;font-size:0.75rem;color:var(--text-faint);">' +
                '<span>' + lv.emoji + ' ' + fEsc(a.authorName || 'Anon') + '</span>' +
                '<span>·</span><span>' + readTime + ' min read</span>' +
                (dateStr ? '<span>·</span><span>' + dateStr + '</span>' : '') +
            '</div>';
            
            // Stats
            html += '<div style="display:flex;gap:12px;margin-top:8px;font-size:0.75rem;color:var(--text-faint);">' +
                '<span>👍 ' + (a.upvotes || 0) + '</span>' +
                '<span>💬 ' + (a.replyCount || 0) + '</span>' +
                (a.tipTotal ? '<span>⚡ ' + a.tipTotal + ' sats</span>' : '') +
            '</div>';
            
            html += '</div></div>';
        });
        
        container.innerHTML = html;
    } catch(e) {
        console.error('Articles load error:', e);
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#ef4444;">Error loading articles</div>';
    }
}

// ---- Article Terms ----
var ARTICLE_TERMS = [
    'Content must be Bitcoin-focused or Bitcoin-adjacent',
    'Minimum 500 words, maximum 10,000 words',
    'No promotion of altcoins, scams, or affiliate spam',
    'Original content only — no plagiarism',
    'No hate speech or personal attacks',
    'Author grants the archive a non-exclusive license to display the content',
    'Moderators may remove content that violates these guidelines'
];

// ---- New Article Form ----
window.articleNew = function() {
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        if (typeof showUsernamePrompt === 'function') showUsernamePrompt();
        if (typeof showToast === 'function') showToast('🔒 Sign in to write articles');
        return;
    }
    var pts = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.points || 0 : 0;
    if (pts < 100) {
        if (typeof showToast === 'function') showToast('📝 You need 100+ points to publish articles. Keep exploring!');
        return;
    }
    
    // Check for draft
    var draft = null;
    try { draft = JSON.parse(localStorage.getItem('btc_article_draft')); } catch(e) {}
    
    var fc = document.getElementById('forumContainer');
    if (!fc) return;
    
    var _s = 'width:100%;padding:12px;background:var(--input-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:16px;font-family:inherit;outline:none;box-sizing:border-box;margin-bottom:12px;-webkit-appearance:none;';
    
    var html = '<div style="max-width:700px;margin:0 auto;padding:16px 12px;">';
    html += '<button onclick="forumTab=\'articles\';renderForum()" style="background:none;border:none;color:var(--text-muted);font-size:0.85rem;cursor:pointer;padding:8px 0;margin-bottom:8px;font-family:inherit;">← Back to Articles</button>';
    html += '<h2 style="color:var(--heading);font-size:1.2rem;font-weight:800;margin:0 0 14px;">✍️ Write an Article</h2>';
    
    html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;">';
    
    // Title
    html += '<label style="color:var(--text-muted);font-size:0.8rem;display:block;margin-bottom:4px;">Title *</label>' +
        '<input type="text" id="articleTitle" maxlength="120" placeholder="Your article title" value="' + (draft && draft.title ? fEsc(draft.title) : '') + '" style="' + _s + '">';
    
    // Subtitle
    html += '<label style="color:var(--text-muted);font-size:0.8rem;display:block;margin-bottom:4px;">Subtitle <span style="color:var(--text-faint);">(optional)</span></label>' +
        '<input type="text" id="articleSubtitle" maxlength="200" placeholder="Brief description" value="' + (draft && draft.subtitle ? fEsc(draft.subtitle) : '') + '" style="' + _s + '">';
    
    // Tags
    html += '<label style="color:var(--text-muted);font-size:0.8rem;display:block;margin-bottom:6px;">Tags (pick 1-3) *</label>' +
        '<div id="articleTagsContainer" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">';
    var draftTags = (draft && draft.tags) ? draft.tags : [];
    ARTICLE_TAGS.forEach(function(t) {
        var sel = draftTags.indexOf(t) !== -1;
        html += '<button onclick="toggleArticleTag(this,\'' + t + '\')" data-tag="' + t + '" style="padding:6px 12px;border-radius:16px;font-size:0.75rem;cursor:pointer;font-family:inherit;border:1px solid ' + (sel ? 'var(--accent)' : 'var(--border)') + ';background:' + (sel ? 'var(--accent-bg)' : 'none') + ';color:' + (sel ? 'var(--accent)' : 'var(--text-muted)') + ';font-weight:600;">' + t + '</button>';
    });
    html += '</div>';
    
    // Body with preview toggle
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
        '<label style="color:var(--text-muted);font-size:0.8rem;">Article Body * <span style="color:var(--text-faint);">(Markdown supported)</span></label>' +
        '<button onclick="toggleArticlePreview()" id="articlePreviewBtn" style="padding:4px 10px;background:none;border:1px solid var(--border);border-radius:6px;color:var(--text-muted);font-size:0.7rem;cursor:pointer;font-family:inherit;">Preview</button>' +
    '</div>' +
    '<div id="articleToolbar" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;padding:8px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;">' +
        '<button type="button" onclick="articleInsert(\'**\',\'**\',\'bold text\')" style="padding:4px 8px;background:none;border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:0.8rem;cursor:pointer;font-family:inherit;font-weight:800;" title="Bold">B</button>' +
        '<button type="button" onclick="articleInsert(\'*\',\'*\',\'italic text\')" style="padding:4px 8px;background:none;border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:0.8rem;cursor:pointer;font-family:inherit;font-style:italic;" title="Italic">I</button>' +
        '<button type="button" onclick="articleInsert(\'## \',\'\\n\',\'Heading\')" style="padding:4px 8px;background:none;border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:0.8rem;cursor:pointer;font-family:inherit;font-weight:700;" title="Heading">H</button>' +
        '<button type="button" onclick="articleInsert(\'> \',\'\\n\',\'quote\')" style="padding:4px 8px;background:none;border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:0.8rem;cursor:pointer;font-family:inherit;" title="Quote">❝</button>' +
        '<button type="button" onclick="articleInsert(\'- \',\'\\n\',\'list item\')" style="padding:4px 8px;background:none;border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:0.8rem;cursor:pointer;font-family:inherit;" title="List">•</button>' +
        '<span style="width:1px;background:var(--border);margin:0 4px;"></span>' +
        '<button type="button" onclick="articleInsertLink()" style="padding:4px 10px;background:none;border:1px solid var(--border);border-radius:6px;color:var(--accent);font-size:0.8rem;cursor:pointer;font-family:inherit;font-weight:700;" title="Insert Link">🔗 Link</button>' +
        '<button type="button" onclick="articleInsertImage()" style="padding:4px 10px;background:none;border:1px solid var(--border);border-radius:6px;color:var(--accent);font-size:0.8rem;cursor:pointer;font-family:inherit;font-weight:700;" title="Insert Image">🖼️ Image</button>' +
        '<button type="button" onclick="articleInsert(\'---\\n\',\'\',\'\')" style="padding:4px 8px;background:none;border:1px solid var(--border);border-radius:6px;color:var(--text-muted);font-size:0.8rem;cursor:pointer;font-family:inherit;" title="Horizontal Rule">—</button>' +
    '</div>' +
    '<textarea id="articleBody" rows="15" maxlength="50000" placeholder="Write your article here...\n\nUse the toolbar above to format text, add links, and insert images.\n\n# Headings\n**Bold** and *italic*\n> Blockquotes\n- Bullet lists\n[Link text](https://example.com)\n![Image](https://example.com/photo.jpg)" style="' + _s + 'resize:vertical;min-height:300px;line-height:1.7;font-family:monospace;font-size:14px;">' + (draft && draft.body ? fEsc(draft.body) : '') + '</textarea>' +
    '<div id="articlePreviewArea" style="display:none;padding:16px;background:var(--bg-side);border:1px solid var(--border);border-radius:10px;margin-bottom:12px;min-height:200px;"></div>';
    
    // Word count
    html += '<div id="articleWordCount" style="text-align:right;font-size:0.7rem;color:var(--text-faint);margin:-8px 0 12px;">0 words · Min 500</div>';
    
    // Cover image
    html += '<label style="color:var(--text-muted);font-size:0.8rem;display:block;margin-bottom:4px;">Cover Image <span style="color:var(--text-faint);">(optional)</span></label>' +
        '<input type="file" id="articleCover" accept="image/jpeg,image/png,image/webp" style="' + _s + 'font-size:0.8rem;">';
    
    // Terms
    html += '<div style="background:rgba(247,147,26,0.05);border:1px dashed var(--accent);border-radius:10px;padding:12px;margin:12px 0;">' +
        '<div style="font-size:0.75rem;color:var(--accent);font-weight:700;margin-bottom:6px;">📋 Content Guidelines</div>';
    ARTICLE_TERMS.forEach(function(t) {
        html += '<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:3px;">• ' + t + '</div>';
    });
    html += '<label style="display:flex;align-items:center;gap:8px;margin-top:8px;cursor:pointer;">' +
        '<input type="checkbox" id="articleTerms" style="width:18px;height:18px;accent-color:#f7931a;">' +
        '<span style="font-size:0.8rem;color:var(--text);font-weight:600;">I agree to these guidelines</span>' +
    '</label></div>';
    
    // Submit + Save Draft
    html += '<div style="display:flex;gap:8px;">' +
        '<button onclick="articleSaveDraft()" style="flex:1;padding:14px;background:var(--card-bg);border:1px solid var(--border);color:var(--text-muted);border-radius:10px;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;">💾 Save Draft</button>' +
        '<button onclick="articleSubmit()" style="flex:2;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;">📝 Publish Article</button>' +
    '</div>';
    html += '<div id="articleStatus" style="margin-top:8px;font-size:0.85rem;text-align:center;"></div>';
    
    html += '</div></div>';
    fc.innerHTML = html;
    document.getElementById('main').scrollTop = 0;
    
    // Word count updater
    var bodyEl = document.getElementById('articleBody');
    if (bodyEl) {
        bodyEl.addEventListener('input', function() {
            var wc = this.value.trim().split(/\s+/).filter(function(w) { return w.length > 0; }).length;
            var el = document.getElementById('articleWordCount');
            if (el) el.textContent = wc + ' words · Min 500';
        });
        // Auto-save draft every 30 seconds
        window._articleAutoSave = setInterval(function() { articleSaveDraft(true); }, 30000);
    }
};

// Tag toggle
window.toggleArticleTag = function(btn, tag) {
    var sel = btn.style.borderColor.indexOf('var(--accent)') !== -1 || btn.style.color.indexOf('var(--accent)') !== -1;
    if (sel) {
        btn.style.border = '1px solid var(--border)';
        btn.style.background = 'none';
        btn.style.color = 'var(--text-muted)';
    } else {
        // Count selected
        var count = document.querySelectorAll('#articleTagsContainer button[style*="accent-bg"]').length;
        if (count >= 3) { if (typeof showToast === 'function') showToast('Max 3 tags'); return; }
        btn.style.border = '1px solid var(--accent)';
        btn.style.background = 'var(--accent-bg)';
        btn.style.color = 'var(--accent)';
    }
};

// Preview toggle
// ---- Article Editor Toolbar Helpers ----
window.articleInsert = function(before, after, placeholder) {
    var ta = document.getElementById('articleBody');
    if (!ta) return;
    ta.focus();
    var start = ta.selectionStart, end = ta.selectionEnd;
    var selected = ta.value.substring(start, end);
    var text = selected || placeholder;
    var insert = before + text + after;
    ta.setRangeText(insert, start, end, 'select');
    // Select just the text portion for easy replacement
    if (!selected) {
        ta.selectionStart = start + before.length;
        ta.selectionEnd = start + before.length + text.length;
    }
    ta.dispatchEvent(new Event('input'));
};

window.articleInsertLink = function() {
    var ta = document.getElementById('articleBody');
    if (!ta) return;
    var selected = ta.value.substring(ta.selectionStart, ta.selectionEnd);
    
    // Show a small inline dialog
    var existing = document.getElementById('articleLinkDialog');
    if (existing) existing.remove();
    var dialog = document.createElement('div');
    dialog.id = 'articleLinkDialog';
    dialog.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);padding:16px;';
    dialog.onclick = function(e) { if (e.target === dialog) dialog.remove(); };
    var is = 'width:100%;padding:10px 12px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.9rem;font-family:inherit;box-sizing:border-box;margin-bottom:10px;';
    dialog.innerHTML =
        '<div style="background:var(--bg-side);border:1px solid var(--accent);border-radius:16px;padding:24px;max-width:380px;width:100%;">' +
            '<h3 style="color:var(--heading);margin:0 0 16px;font-size:1rem;">🔗 Insert Link</h3>' +
            '<label style="display:block;font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">Link Text</label>' +
            '<input type="text" id="linkDialogText" value="' + (typeof fEsc === 'function' ? fEsc(selected) : selected) + '" placeholder="Click here to read more" style="' + is + '">' +
            '<label style="display:block;font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">URL</label>' +
            '<input type="url" id="linkDialogUrl" placeholder="https://example.com" style="' + is + '">' +
            '<div style="display:flex;gap:8px;">' +
                '<button onclick="document.getElementById(\'articleLinkDialog\').remove()" style="flex:1;padding:10px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);cursor:pointer;font-family:inherit;">Cancel</button>' +
                '<button onclick="articleDoInsertLink()" style="flex:2;padding:10px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;">Insert Link</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(dialog);
    setTimeout(function() { document.getElementById('linkDialogUrl').focus(); }, 100);
};

window.articleDoInsertLink = function() {
    var text = (document.getElementById('linkDialogText').value || '').trim() || 'link';
    var url = (document.getElementById('linkDialogUrl').value || '').trim();
    if (!url) { if (typeof showToast === 'function') showToast('Enter a URL'); return; }
    if (!url.match(/^https?:\/\//)) url = 'https://' + url;
    var ta = document.getElementById('articleBody');
    if (ta) {
        var md = '[' + text + '](' + url + ')';
        var start = ta.selectionStart;
        ta.setRangeText(md, start, ta.selectionEnd, 'end');
        ta.dispatchEvent(new Event('input'));
    }
    document.getElementById('articleLinkDialog').remove();
};

window.articleInsertImage = function() {
    var existing = document.getElementById('articleImageDialog');
    if (existing) existing.remove();
    var dialog = document.createElement('div');
    dialog.id = 'articleImageDialog';
    dialog.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);padding:16px;';
    dialog.onclick = function(e) { if (e.target === dialog) dialog.remove(); };
    var is = 'width:100%;padding:10px 12px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.9rem;font-family:inherit;box-sizing:border-box;margin-bottom:10px;';
    dialog.innerHTML =
        '<div style="background:var(--bg-side);border:1px solid var(--accent);border-radius:16px;padding:24px;max-width:380px;width:100%;">' +
            '<h3 style="color:var(--heading);margin:0 0 16px;font-size:1rem;">🖼️ Insert Image</h3>' +
            '<label style="display:block;font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">Image URL</label>' +
            '<input type="url" id="imageDialogUrl" placeholder="https://example.com/photo.jpg" style="' + is + '">' +
            '<label style="display:block;font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">Caption <span style="color:var(--text-faint);">(optional)</span></label>' +
            '<input type="text" id="imageDialogAlt" placeholder="Describe the image" style="' + is + '">' +
            '<div style="margin-bottom:12px;padding:8px 10px;background:rgba(247,147,26,0.05);border:1px dashed var(--border);border-radius:8px;">' +
                '<div style="font-size:0.7rem;color:var(--text-faint);margin-bottom:6px;">Or upload from device:</div>' +
                '<input type="file" id="imageDialogFile" accept="image/jpeg,image/png,image/webp,image/gif" style="font-size:0.8rem;color:var(--text);">' +
            '</div>' +
            '<div id="imageDialogPreview" style="display:none;margin-bottom:10px;text-align:center;"></div>' +
            '<div style="display:flex;gap:8px;">' +
                '<button onclick="document.getElementById(\'articleImageDialog\').remove()" style="flex:1;padding:10px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);cursor:pointer;font-family:inherit;">Cancel</button>' +
                '<button onclick="articleDoInsertImage()" id="imageDialogBtn" style="flex:2;padding:10px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;">Insert Image</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(dialog);
    // Handle file upload → Firebase Storage
    setTimeout(function() {
        var fileInput = document.getElementById('imageDialogFile');
        if (fileInput) fileInput.addEventListener('change', function() {
            var file = this.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) { if (typeof showToast === 'function') showToast('Image too large (max 5MB)'); return; }
            var preview = document.getElementById('imageDialogPreview');
            var btn = document.getElementById('imageDialogBtn');
            if (btn) { btn.disabled = true; btn.textContent = 'Uploading...'; }
            // Try Firebase Storage
            if (typeof firebase !== 'undefined' && firebase.storage && typeof auth !== 'undefined' && auth.currentUser) {
                var ref = firebase.storage().ref('article-images/' + auth.currentUser.uid + '/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_'));
                ref.put(file).then(function(snap) {
                    return snap.ref.getDownloadURL();
                }).then(function(url) {
                    document.getElementById('imageDialogUrl').value = url;
                    if (preview) { preview.style.display = 'block'; preview.innerHTML = '<img src="' + url + '" style="max-width:100%;max-height:150px;border-radius:8px;">'; }
                    if (btn) { btn.disabled = false; btn.textContent = 'Insert Image'; }
                    if (typeof showToast === 'function') showToast('✅ Image uploaded!');
                }).catch(function(err) {
                    if (typeof showToast === 'function') showToast('Upload failed: ' + (err.message || 'Unknown error'));
                    if (btn) { btn.disabled = false; btn.textContent = 'Insert Image'; }
                });
            } else {
                // No Firebase Storage — fall back to data URL (limited)
                var reader = new FileReader();
                reader.onload = function(e) {
                    document.getElementById('imageDialogUrl').value = e.target.result;
                    if (preview) { preview.style.display = 'block'; preview.innerHTML = '<img src="' + e.target.result + '" style="max-width:100%;max-height:150px;border-radius:8px;">'; }
                    if (btn) { btn.disabled = false; btn.textContent = 'Insert Image'; }
                };
                reader.readAsDataURL(file);
            }
        });
        document.getElementById('imageDialogUrl').focus();
    }, 100);
};

window.articleDoInsertImage = function() {
    var url = (document.getElementById('imageDialogUrl').value || '').trim();
    var alt = (document.getElementById('imageDialogAlt').value || '').trim() || 'image';
    if (!url) { if (typeof showToast === 'function') showToast('Enter an image URL or upload a file'); return; }
    var ta = document.getElementById('articleBody');
    if (ta) {
        var md = '\n![' + alt + '](' + url + ')\n';
        var start = ta.selectionStart;
        ta.setRangeText(md, start, ta.selectionEnd, 'end');
        ta.dispatchEvent(new Event('input'));
    }
    document.getElementById('articleImageDialog').remove();
};

window.toggleArticlePreview = function() {
    var body = document.getElementById('articleBody');
    var preview = document.getElementById('articlePreviewArea');
    var btn = document.getElementById('articlePreviewBtn');
    if (!body || !preview) return;
    if (preview.style.display === 'none') {
        preview.innerHTML = mdToHtml(body.value);
        preview.style.display = 'block';
        body.style.display = 'none';
        btn.textContent = 'Edit';
    } else {
        preview.style.display = 'none';
        body.style.display = '';
        btn.textContent = 'Preview';
    }
};

// Save draft
window.articleSaveDraft = function(silent) {
    var title = (document.getElementById('articleTitle') || {}).value || '';
    var subtitle = (document.getElementById('articleSubtitle') || {}).value || '';
    var body = (document.getElementById('articleBody') || {}).value || '';
    var tags = [];
    document.querySelectorAll('#articleTagsContainer button').forEach(function(b) {
        if (b.style.color && b.style.color.indexOf('var(--accent)') !== -1) tags.push(b.getAttribute('data-tag'));
    });
    if (!title && !body) return;
    localStorage.setItem('btc_article_draft', JSON.stringify({ title: title, subtitle: subtitle, body: body, tags: tags, savedAt: Date.now() }));
    if (!silent && typeof showToast === 'function') showToast('💾 Draft saved!');
};

// ---- Submit Article ----
window.articleSubmit = async function() {
    if (window._articleSubmitting) return;
    var status = document.getElementById('articleStatus');
    
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        if (status) status.innerHTML = '<span style="color:#ef4444;">Sign in required</span>';
        return;
    }
    
    var title = (document.getElementById('articleTitle').value || '').trim();
    var subtitle = (document.getElementById('articleSubtitle').value || '').trim();
    var body = (document.getElementById('articleBody').value || '').trim();
    var terms = document.getElementById('articleTerms');
    
    if (!title || title.length < 10) { if (status) status.innerHTML = '<span style="color:#ef4444;">Title must be at least 10 characters</span>'; return; }
    
    var wordCount = body.split(/\s+/).filter(function(w) { return w.length > 0; }).length;
    if (wordCount < 500) { if (status) status.innerHTML = '<span style="color:#ef4444;">Article must be at least 500 words (currently ' + wordCount + ')</span>'; return; }
    if (wordCount > 10000) { if (status) status.innerHTML = '<span style="color:#ef4444;">Article must be under 10,000 words</span>'; return; }
    
    var tags = [];
    document.querySelectorAll('#articleTagsContainer button').forEach(function(b) {
        if (b.style.color && b.style.color.indexOf('var(--accent)') !== -1) tags.push(b.getAttribute('data-tag'));
    });
    if (tags.length < 1) { if (status) status.innerHTML = '<span style="color:#ef4444;">Select at least 1 tag</span>'; return; }
    
    if (!terms || !terms.checked) { if (status) status.innerHTML = '<span style="color:#ef4444;">You must agree to the content guidelines</span>'; return; }
    
    if (!isCleanText(title) || !isCleanText(body)) { if (status) status.innerHTML = '<span style="color:#ef4444;">Content contains inappropriate language</span>'; return; }
    
    window._articleSubmitting = true;
    if (status) status.innerHTML = '<span style="color:var(--text-muted);">Publishing...</span>';
    
    try {
        var userName = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'Anon';
        var userPts = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.points || 0 : 0;
        var userPic = (typeof currentUser !== 'undefined' && currentUser && currentUser.profilePic) ? currentUser.profilePic : '';
        
        // Upload cover image if provided
        var coverUrl = '';
        var coverInput = document.getElementById('articleCover');
        if (coverInput && coverInput.files && coverInput.files[0]) {
            var file = coverInput.files[0];
            if (file.size > 3 * 1024 * 1024) { if (status) status.innerHTML = '<span style="color:#ef4444;">Cover image too large (max 3MB)</span>'; window._articleSubmitting = false; return; }
            if (status) status.innerHTML = '<span style="color:var(--text-muted);">Uploading cover...</span>';
            try {
                var storage = firebase.storage();
                var ref = storage.ref('articles/' + auth.currentUser.uid + '/' + Date.now() + '_cover');
                var snap = await ref.put(file);
                coverUrl = await snap.ref.getDownloadURL();
            } catch(e) { console.warn('Cover upload failed:', e); }
        }
        
        if (status) status.innerHTML = '<span style="color:var(--text-muted);">Publishing article...</span>';
        
        var articleData = {
            title: title.substring(0, 120),
            subtitle: subtitle.substring(0, 200),
            body: body.substring(0, 50000),
            tags: tags.slice(0, 3),
            wordCount: wordCount,
            readTime: Math.max(1, Math.round(wordCount / 200)),
            authorId: auth.currentUser.uid,
            authorName: userName,
            authorPoints: userPts,
            authorPic: userPic,
            upvotes: 0,
            voters: [],
            replyCount: 0,
            tipTotal: 0,
            status: 'published',
            pinned: false,
            agreedToTerms: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (coverUrl) articleData.coverUrl = coverUrl;
        
        await db.collection('articles').add(articleData);
        
        // Clear draft
        localStorage.removeItem('btc_article_draft');
        if (window._articleAutoSave) clearInterval(window._articleAutoSave);
        
        // Awards
        if (typeof awardPoints === 'function') awardPoints(30, '📝 Article published');
        if (typeof awardTickets === 'function') awardTickets(20, '📝 Article published');
        var _ac = parseInt(localStorage.getItem('btc_articles_published') || '0'); localStorage.setItem('btc_articles_published', String(_ac + 1));
        
        if (typeof showToast === 'function') showToast('📝 Article published!');
        forumTab = 'articles';
        renderForum();
    } catch(e) {
        console.error('Article submit error:', e);
        if (status) status.innerHTML = '<span style="color:#ef4444;">Error publishing: ' + fEsc(e.message) + '</span>';
    }
    window._articleSubmitting = false;
};

// ---- View Article ----
window.articleView = async function(articleId) {
    var fc = document.getElementById('forumContainer');
    if (!fc || !db) return;
    
    fc.innerHTML = '<div style="max-width:700px;margin:0 auto;padding:40px 12px;text-align:center;color:var(--text-muted);">Loading article...</div>';
    
    try {
        var doc = await db.collection('articles').doc(articleId).get();
        if (!doc.exists) { fc.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;">Article not found</div>'; return; }
        var a = doc.data();
        a.id = articleId;
        
        var lv = typeof getLevel === 'function' ? getLevel(a.authorPoints || 0) : { emoji: '🟢' };
        var readTime = Math.max(1, Math.round((a.wordCount || 500) / 200));
        var dateStr = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().toLocaleDateString() : '';
        var isAuthor = auth && auth.currentUser && auth.currentUser.uid === a.authorId;
        var isAdmin = isForumAdmin();
        var hasVoted = auth && auth.currentUser && (a.voters || []).indexOf(auth.currentUser.uid) !== -1;
        
        var html = '<div style="max-width:700px;margin:0 auto;padding:16px 12px;">';
        html += '<button onclick="forumTab=\'articles\';renderForum()" style="background:none;border:none;color:var(--text-muted);font-size:0.85rem;cursor:pointer;padding:8px 0;margin-bottom:12px;font-family:inherit;">← Back to Articles</button>';
        
        // Cover
        if (a.coverUrl) {
            html += '<div style="margin:-16px -12px 20px;border-radius:0 0 16px 16px;overflow:hidden;"><img src="' + fEsc(a.coverUrl) + '" alt="Cover" style="width:100%;display:block;object-fit:contain;max-height:500px;"></div>';
        }
        
        // Title
        html += '<h1 style="color:var(--heading);font-size:1.6rem;font-weight:900;margin:0 0 8px;line-height:1.3;">' + fEsc(a.title) + '</h1>';
        if (a.subtitle) html += '<div style="color:var(--text-muted);font-size:1rem;margin-bottom:16px;line-height:1.4;">' + fEsc(a.subtitle) + '</div>';
        
        // Author bar
        html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border);">';
        if (a.authorPic) html += '<img src="' + fEsc(a.authorPic) + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid var(--border);">';
        html += '<div>' +
            '<div style="font-weight:700;font-size:0.9rem;color:var(--text);cursor:pointer;" onclick="if(typeof showUserProfile===\'function\')showUserProfile(\'' + a.authorId + '\')">' + lv.emoji + ' ' + fEsc(a.authorName || 'Anon') + '</div>' +
            '<div style="font-size:0.75rem;color:var(--text-faint);">' + dateStr + ' · ' + readTime + ' min read · ' + (a.wordCount || 0).toLocaleString() + ' words</div>' +
        '</div>';
        // Edit button for author
        if (isAuthor) html += '<button onclick="articleEdit(\'' + articleId + '\')" style="margin-left:auto;padding:6px 12px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:0.75rem;cursor:pointer;font-family:inherit;">✏️ Edit</button>';
        // Pin button for admin
        if (isAdmin) html += '<button onclick="articleTogglePin(\'' + articleId + '\',' + (a.pinned ? 'false' : 'true') + ')" style="margin-left:' + (isAuthor ? '4px' : 'auto') + ';padding:6px 12px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:0.75rem;cursor:pointer;font-family:inherit;">' + (a.pinned ? '📌 Unpin' : '📌 Pin') + '</button>';
        html += '</div>';
        
        // Tags
        if (a.tags && a.tags.length) {
            html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:20px;">';
            a.tags.forEach(function(t) { html += '<span style="padding:3px 10px;background:var(--accent-bg);border-radius:12px;font-size:0.7rem;color:var(--accent);font-weight:600;">' + fEsc(t) + '</span>'; });
            html += '</div>';
        }
        
        // Article body (rendered markdown)
        html += '<div style="line-height:1.8;font-size:1rem;color:var(--text);margin-bottom:30px;">' + mdToHtml(a.body) + '</div>';
        
        // Action bar
        html += '<div style="display:flex;align-items:center;gap:12px;padding:16px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin-bottom:20px;">';
        html += '<button onclick="articleVote(\'' + articleId + '\')" style="display:flex;align-items:center;gap:4px;background:' + (hasVoted ? 'var(--accent-bg)' : 'none') + ';border:1px solid ' + (hasVoted ? 'var(--accent)' : 'var(--border)') + ';border-radius:16px;padding:8px 14px;cursor:pointer;color:' + (hasVoted ? 'var(--accent)' : 'var(--text-muted)') + ';font-size:0.85rem;font-weight:600;font-family:inherit;">👍 ' + (a.upvotes || 0) + '</button>';
        
        // Tip button
        if (typeof tipButtonHtml === 'function') {
            html += tipButtonHtml({ recipientName: a.authorName, recipientUid: a.authorId, context: 'article', contextId: articleId, label: '⚡ Tip Author', size: 'md' });
        }
        
        // Delete for admin/author
        if (isAuthor || isAdmin) {
            html += '<button onclick="articleDelete(\'' + articleId + '\')" style="margin-left:auto;padding:8px 14px;background:none;border:1px solid #ef4444;border-radius:10px;color:#ef4444;font-size:0.8rem;cursor:pointer;font-family:inherit;">🗑️ Delete</button>';
        }
        html += '</div>';
        
        // Comments (reuse forum reply system)
        html += '<h3 style="color:var(--heading);font-size:1rem;font-weight:700;margin-bottom:12px;">💬 Comments</h3>';
        html += '<div id="articleReplies"><div style="text-align:center;padding:20px;color:var(--text-muted);font-size:0.85rem;">Loading comments...</div></div>';
        
        // Reply input
        if (auth && auth.currentUser && !auth.currentUser.isAnonymous) {
            html += '<div style="margin-top:12px;">' +
                '<textarea id="articleReplyInput" rows="3" maxlength="1000" placeholder="Share your thoughts..." style="width:100%;padding:12px;background:var(--input-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:16px;font-family:inherit;outline:none;box-sizing:border-box;resize:vertical;"></textarea>' +
                '<button onclick="articleSubmitReply(\'' + articleId + '\')" style="margin-top:6px;padding:10px 20px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">Post Comment</button>' +
                '<div id="articleReplyStatus" style="margin-top:4px;font-size:0.8rem;"></div>' +
            '</div>';
        }
        
        html += '</div>';
        fc.innerHTML = html;
        document.getElementById('main').scrollTop = 0;
        
        // Load comments
        articleLoadReplies(articleId);
        
        // Reading reward — award points after 60 seconds
        if (auth && auth.currentUser) {
            var readKey = 'btc_article_read_' + articleId;
            if (!localStorage.getItem(readKey)) {
                setTimeout(function() {
                    if (document.getElementById('articleReplies')) {
                        localStorage.setItem(readKey, '1');
                        if (typeof awardPoints === 'function') awardPoints(5, '📖 Read an article');
                        if (typeof showToast === 'function') showToast('📖 +5 points for reading!');
                    }
                }, 60000);
            }
        }
    } catch(e) {
        console.error('Article view error:', e);
        fc.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;">Error loading article</div>';
    }
};

// ---- Article Vote ----
window.articleVote = async function(articleId) {
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        if (typeof showToast === 'function') showToast('🔒 Sign in to upvote');
        return;
    }
    try {
        var ref = db.collection('articles').doc(articleId);
        var doc = await ref.get();
        if (!doc.exists) return;
        var voters = doc.data().voters || [];
        var uid = auth.currentUser.uid;
        if (voters.indexOf(uid) !== -1) {
            await ref.update({ upvotes: firebase.firestore.FieldValue.increment(-1), voters: firebase.firestore.FieldValue.arrayRemove(uid) });
        } else {
            await ref.update({ upvotes: firebase.firestore.FieldValue.increment(1), voters: firebase.firestore.FieldValue.arrayUnion(uid) });
            var _ad = doc.data();
            if (_ad.authorId && typeof sendNotification === 'function') {
                var _un = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'Someone';
                sendNotification(_ad.authorId, 'upvote', _un + ' upvoted your article "' + (_ad.title || '').substring(0, 40) + '"', 'article', articleId);
            }
        }
        articleView(articleId);
    } catch(e) {}
};

// ---- Article Comments ----
async function articleLoadReplies(articleId) {
    var container = document.getElementById('articleReplies');
    if (!container) return;
    try {
        var snap = await db.collection('article_replies').where('articleId', '==', articleId).orderBy('createdAt', 'asc').limit(50).get();
        if (snap.empty) { container.innerHTML = '<div style="padding:12px;color:var(--text-faint);font-size:0.85rem;">No comments yet. Be the first!</div>'; return; }
        var html = '';
        snap.forEach(function(doc) {
            var r = doc.data();
            var rlv = typeof getLevel === 'function' ? getLevel(r.authorPoints || 0) : { emoji: '🟢' };
            var rDate = r.createdAt && r.createdAt.toDate ? (typeof timeAgo === 'function' ? timeAgo(r.createdAt.toDate()) : r.createdAt.toDate().toLocaleDateString()) : '';
            var canDel = auth && auth.currentUser && (auth.currentUser.uid === r.authorId || isForumAdmin());
            html += '<div style="padding:12px 0;border-bottom:1px solid var(--border);">' +
                '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">' +
                    '<span style="font-size:0.8rem;color:var(--text-muted);cursor:pointer;" onclick="if(typeof showUserProfile===\'function\')showUserProfile(\'' + r.authorId + '\')">' + rlv.emoji + ' ' + fEsc(r.authorName || 'Anon') + '</span>' +
                    '<span style="font-size:0.7rem;color:var(--text-faint);">· ' + rDate + '</span>' +
                    (canDel ? '<button onclick="articleDeleteReply(\'' + doc.id + '\',\'' + articleId + '\')" style="margin-left:auto;background:none;border:none;color:var(--text-faint);font-size:0.7rem;cursor:pointer;">🗑️</button>' : '') +
                '</div>' +
                '<div style="font-size:0.9rem;color:var(--text);line-height:1.6;">' + forumRenderMentions(fEsc(r.body).replace(/\n/g, '<br>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:var(--accent);">$1</a>')) + '</div>' +
            '</div>';
        });
        container.innerHTML = html;
    } catch(e) { container.innerHTML = '<div style="color:#ef4444;font-size:0.85rem;">Error loading comments</div>'; }
}

window.articleSubmitReply = async function(articleId) {
    var input = document.getElementById('articleReplyInput');
    var status = document.getElementById('articleReplyStatus');
    if (!input || !auth || !auth.currentUser || auth.currentUser.isAnonymous) return;
    var body = input.value.trim();
    if (!body || body.length < 2) { if (status) status.innerHTML = '<span style="color:#ef4444;">Comment too short</span>'; return; }
    if (!isCleanText(body)) { if (status) status.innerHTML = '<span style="color:#ef4444;">Inappropriate language</span>'; return; }
    try {
        var userName = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'Anon';
        var userPts = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.points || 0 : 0;
        await db.collection('article_replies').add({
            articleId: articleId, body: body.substring(0, 1000), authorId: auth.currentUser.uid,
            authorName: userName, authorPoints: userPts, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await db.collection('articles').doc(articleId).update({ replyCount: firebase.firestore.FieldValue.increment(1) });
        if (typeof awardPoints === 'function') awardPoints(5, '💬 Article comment');
        // Notify article author + @mentioned users
        try {
            var _aDoc = await db.collection('articles').doc(articleId).get();
            if (_aDoc.exists && _aDoc.data().authorId && typeof sendNotification === 'function') {
                var _un = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'Someone';
                sendNotification(_aDoc.data().authorId, 'comment', _un + ' commented on your article "' + (_aDoc.data().title || '').substring(0, 40) + '"', 'article', articleId);
            }
            forumNotifyMentions(body, 'article', articleId, _aDoc && _aDoc.exists ? _aDoc.data().title : '');
        } catch(e) {}
        input.value = '';
        if (status) status.innerHTML = '<span style="color:#22c55e;">✅ Comment posted!</span>';
        articleLoadReplies(articleId);
    } catch(e) { if (status) status.innerHTML = '<span style="color:#ef4444;">Error posting comment</span>'; }
};

window.articleDeleteReply = async function(replyId, articleId) {
    if (!confirm('Delete this comment?')) return;
    try {
        await db.collection('article_replies').doc(replyId).delete();
        await db.collection('articles').doc(articleId).update({ replyCount: firebase.firestore.FieldValue.increment(-1) });
        if (typeof showToast === 'function') showToast('🗑️ Comment deleted');
        articleLoadReplies(articleId);
    } catch(e) {}
};

// ---- Article Edit ----
window.articleEdit = async function(articleId) {
    try {
        var doc = await db.collection('articles').doc(articleId).get();
        if (!doc.exists) return;
        var a = doc.data();
        if (auth.currentUser.uid !== a.authorId && !isForumAdmin()) return;
        // Load into the editor with draft override
        localStorage.setItem('btc_article_draft', JSON.stringify({ title: a.title, subtitle: a.subtitle || '', body: a.body, tags: a.tags || [] }));
        window._articleEditId = articleId;
        articleNew();
        // Change submit button to "Update"
        setTimeout(function() {
            var btn = document.querySelector('[onclick="articleSubmit()"]');
            if (btn) { btn.textContent = '✏️ Update Article'; btn.setAttribute('onclick', 'articleUpdate()'); }
        }, 100);
    } catch(e) { if (typeof showToast === 'function') showToast('Error loading article for edit'); }
};

window.articleUpdate = async function() {
    var articleId = window._articleEditId;
    if (!articleId) return;
    var status = document.getElementById('articleStatus');
    
    var title = (document.getElementById('articleTitle').value || '').trim();
    var subtitle = (document.getElementById('articleSubtitle').value || '').trim();
    var body = (document.getElementById('articleBody').value || '').trim();
    var wordCount = body.split(/\s+/).filter(function(w) { return w.length > 0; }).length;
    
    if (!title || title.length < 10) { if (status) status.innerHTML = '<span style="color:#ef4444;">Title must be at least 10 characters</span>'; return; }
    if (wordCount < 500) { if (status) status.innerHTML = '<span style="color:#ef4444;">Min 500 words</span>'; return; }
    
    var tags = [];
    document.querySelectorAll('#articleTagsContainer button').forEach(function(b) {
        if (b.style.color && b.style.color.indexOf('var(--accent)') !== -1) tags.push(b.getAttribute('data-tag'));
    });
    
    if (status) status.innerHTML = '<span style="color:var(--text-muted);">Updating...</span>';
    try {
        // Upload cover image if provided
        var coverUrl = null;
        var coverInput = document.getElementById('articleCover');
        if (coverInput && coverInput.files && coverInput.files[0]) {
            var file = coverInput.files[0];
            if (file.size > 3 * 1024 * 1024) { if (status) status.innerHTML = '<span style="color:#ef4444;">Cover too large (max 3MB)</span>'; return; }
            if (status) status.innerHTML = '<span style="color:var(--text-muted);">Uploading cover...</span>';
            try {
                var ref = firebase.storage().ref('articles/' + auth.currentUser.uid + '/' + Date.now() + '_cover');
                var snap = await ref.put(file);
                coverUrl = await snap.ref.getDownloadURL();
            } catch(e) { console.warn('Cover upload failed:', e); }
        }
        
        var updateData = {
            title: title.substring(0, 120), subtitle: subtitle.substring(0, 200),
            body: body.substring(0, 50000), tags: tags.slice(0, 3),
            wordCount: wordCount, readTime: Math.max(1, Math.round(wordCount / 200)),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (coverUrl) updateData.coverUrl = coverUrl;
        
        if (status) status.innerHTML = '<span style="color:var(--text-muted);">Saving...</span>';
        await db.collection('articles').doc(articleId).update(updateData);
        localStorage.removeItem('btc_article_draft');
        window._articleEditId = null;
        if (typeof showToast === 'function') showToast('✏️ Article updated!');
        articleView(articleId);
    } catch(e) { if (status) status.innerHTML = '<span style="color:#ef4444;">Error updating</span>'; }
};

// ---- Admin Pin/Unpin ----
window.articleTogglePin = async function(articleId, pinState) {
    try {
        await db.collection('articles').doc(articleId).update({ pinned: pinState });
        if (typeof showToast === 'function') showToast(pinState ? '📌 Article pinned!' : '📌 Article unpinned');
        articleView(articleId);
    } catch(e) {}
};

// ---- Delete Article ----
window.articleDelete = async function(articleId) {
    if (!confirm('Delete this article and all its comments? This cannot be undone.')) return;
    try {
        var repliesSnap = await db.collection('article_replies').where('articleId', '==', articleId).get();
        var batch = db.batch();
        repliesSnap.forEach(function(doc) { batch.delete(doc.ref); });
        batch.delete(db.collection('articles').doc(articleId));
        await batch.commit();
        if (typeof showToast === 'function') showToast('🗑️ Article deleted');
        forumTab = 'articles';
        renderForum();
    } catch(e) { if (typeof showToast === 'function') showToast('Error deleting article'); }
};

// ---- Stacker News Feed ----
window.loadStackerNewsFeed = function(sort, when, sub) {
    var feed = document.getElementById('snFeed');
    if (!feed) return;
    var url = 'https://embed-proxy.needcreations.workers.dev/api/sn?sort=' + encodeURIComponent(sort) + '&when=' + encodeURIComponent(when) + '&limit=21';
    if (sub) url += '&sub=' + encodeURIComponent(sub);
    fetch(url).then(function(r) { return r.json(); }).then(function(data) {
        if (!data || !data.data || !data.data.items || !data.data.items.items) {
            feed.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--text-muted);">Could not load Stacker News feed</div>';
            return;
        }
        var items = data.data.items.items;
        if (!items.length) {
            feed.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--text-muted);">No posts found</div>';
            return;
        }
        feed.innerHTML = snRenderFeedCards(items);
    }).catch(function() {
        feed.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--text-muted);">Failed to load feed. <button onclick="loadStackerNewsFeed(\'' + sort + '\',\'' + when + '\',\'' + (sub||'') + '\')" style="color:var(--accent);background:none;border:none;cursor:pointer;font-family:inherit;text-decoration:underline;">Retry</button></div>';
    });
};

// ---- Stacker News Search ----
window.snDoSearch = function() {
    var input = document.getElementById('snSearchInput');
    if (!input) return;
    var q = input.value.trim();
    if (q.length < 2) return;
    window._snSearchQuery = q;
    renderForum();
};

window.snClearSearch = function() {
    window._snSearchQuery = '';
    renderForum();
};

function snSearchFeed(q) {
    var feed = document.getElementById('snFeed');
    if (!feed) return;
    var url = 'https://embed-proxy.needcreations.workers.dev/api/sn/search?q=' + encodeURIComponent(q);
    fetch(url).then(function(r) { return r.json(); }).then(function(data) {
        if (!data || !data.data || !data.data.search || !data.data.search.items) {
            feed.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--text-muted);">No results found</div>';
            return;
        }
        var items = data.data.search.items;
        if (!items.length) {
            feed.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--text-muted);">No results found for \"' + snEscape(q) + '\"</div>';
            return;
        }
        feed.innerHTML = snRenderFeedCards(items);
    }).catch(function() {
        feed.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--text-muted);">Search failed. <button onclick="snDoSearch()" style="color:var(--accent);background:none;border:none;cursor:pointer;font-family:inherit;text-decoration:underline;">Retry</button></div>';
    });
}

// ---- Shared feed card renderer (used by feed + search) ----
function snRenderFeedCards(items) {
    var h = '';
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var ago = snTimeAgo(item.createdAt);
        var domain = '';
        if (item.url) {
            try { domain = new URL(item.url).hostname.replace('www.',''); } catch(e) {}
        }
        var subName = (item.sub && item.sub.name) ? item.sub.name : '';
        h += '<div onclick="snOpenPost(' + item.id + ')" style="cursor:pointer;padding:14px 16px;border:1px solid var(--border);border-radius:12px;margin-bottom:8px;background:var(--card-bg);transition:border-color 0.2s,transform 0.1s;position:relative;" onmouseover="this.style.borderColor=\'var(--accent)\';this.style.transform=\'translateY(-1px)\'" onmouseout="this.style.borderColor=\'var(--border)\';this.style.transform=\'none\'">';
        h += '<div style="display:flex;gap:12px;align-items:flex-start;">';
        // Sats badge
        h += '<div style="min-width:52px;text-align:center;padding:6px 0;">';
        h += '<div style="font-size:1rem;font-weight:800;color:var(--accent);">' + snFormatSats(item.sats) + '</div>';
        h += '<div style="font-size:0.6rem;color:var(--text-muted);margin-top:1px;">sats</div>';
        h += '</div>';
        // Content
        h += '<div style="flex:1;min-width:0;">';
        h += '<div style="font-size:0.9rem;font-weight:600;color:var(--heading);line-height:1.35;word-break:break-word;">' + snEscape(item.title) + '</div>';
        h += '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px;font-size:0.7rem;color:var(--text-muted);">';
        // Clickable username
        h += '<a href="https://stacker.news/' + snEscape(item.user.name) + '" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="color:var(--text-muted);text-decoration:none;" onmouseover="this.style.color=\'var(--accent)\'" onmouseout="this.style.color=\'var(--text-muted)\'">@' + snEscape(item.user.name) + '</a>';
        h += '<span>\u00b7</span>';
        h += '<span>' + ago + '</span>';
        if (item.ncomments > 0) {
            h += '<span>\u00b7</span>';
            h += '<span>\ud83d\udcac ' + item.ncomments + '</span>';
        }
        if (domain) {
            h += '<span>\u00b7</span>';
            h += '<span style="color:var(--accent);opacity:0.7;">' + snEscape(domain) + '</span>';
        }
        // Territory badge
        if (subName) {
            h += '<span style="padding:2px 8px;border-radius:10px;background:rgba(99,102,241,0.12);color:#818cf8;font-size:0.65rem;font-weight:600;">' + snEscape(subName) + '</span>';
        }
        h += '</div></div>';
        // View on SN link
        h += '<a href="https://stacker.news/items/' + item.id + '" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="position:absolute;top:12px;right:12px;color:var(--text-muted);font-size:0.8rem;text-decoration:none;opacity:0.5;padding:4px;" onmouseover="this.style.opacity=\'1\';this.style.color=\'var(--accent)\'" onmouseout="this.style.opacity=\'0.5\';this.style.color=\'var(--text-muted)\'">\u2197</a>';
        h += '</div></div>';
    }
    return h;
}

// ---- Stacker News In-App Post Viewer ----
window.snOpenPost = function(id) {
    var fc = document.getElementById('forumContainer');
    if (!fc) return;
    fc.innerHTML = '<div style="max-width:700px;margin:0 auto;padding:16px 12px;">' +
        '<div style="text-align:center;padding:60px 0;color:var(--text-muted);">' +
            '<div style="width:40px;height:40px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px;"></div>' +
            'Loading post...' +
        '</div></div>';

    fetch('https://embed-proxy.needcreations.workers.dev/api/sn/item?id=' + id)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!data || !data.data || !data.data.item) {
                fc.innerHTML = '<div style="max-width:700px;margin:0 auto;padding:16px 12px;"><div style="text-align:center;padding:40px 0;color:var(--text-muted);">Post not found. <button onclick="forumTab=\'stacker\';renderForum()" style="color:var(--accent);background:none;border:none;cursor:pointer;font-family:inherit;text-decoration:underline;">Back to feed</button></div></div>';
                return;
            }
            var item = data.data.item;
            snRenderPost(fc, item);
        })
        .catch(function() {
            fc.innerHTML = '<div style="max-width:700px;margin:0 auto;padding:16px 12px;"><div style="text-align:center;padding:40px 0;color:var(--text-muted);">Failed to load post. <button onclick="snOpenPost(' + id + ')" style="color:var(--accent);background:none;border:none;cursor:pointer;font-family:inherit;text-decoration:underline;">Retry</button> · <button onclick="forumTab=\'stacker\';renderForum()" style="color:var(--accent);background:none;border:none;cursor:pointer;font-family:inherit;text-decoration:underline;">Back</button></div></div>';
        });
};

function snRenderPost(fc, item) {
    var h = '<div style="max-width:700px;margin:0 auto;padding:16px 12px;">';

    // Back button
    h += '<button onclick="forumTab=\'stacker\';renderForum()" style="background:none;border:none;color:var(--text-muted);font-size:0.85rem;cursor:pointer;padding:8px 0;margin-bottom:12px;font-family:inherit;touch-action:manipulation;">← Back to Stacker News</button>';

    // Post card
    h += '<div style="border:1px solid var(--border);border-radius:16px;background:var(--card-bg);padding:20px;margin-bottom:16px;">';

    // Title
    h += '<h2 style="font-size:1.2rem;font-weight:800;color:var(--heading);margin:0 0 10px;line-height:1.3;">' + snEscape(item.title) + '</h2>';

    // Meta row
    h += '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:14px;font-size:0.75rem;color:var(--text-muted);">';
    h += '<span style="color:var(--accent);font-weight:700;">⚡ ' + snFormatSats(item.sats) + ' sats</span>';
    h += '<span>·</span>';
    h += '<a href="https://stacker.news/' + snEscape(item.user.name) + '" target="_blank" rel="noopener noreferrer" style="color:var(--text-muted);text-decoration:none;" onmouseover="this.style.color=\'var(--accent)\'" onmouseout="this.style.color=\'var(--text-muted)\'">@' + snEscape(item.user.name) + '</a>';
    h += '<span>·</span>';
    h += '<span>' + snTimeAgo(item.createdAt) + '</span>';
    if (item.ncomments > 0) {
        h += '<span>·</span>';
        h += '<span>💬 ' + item.ncomments + ' comments</span>';
    }
    h += '</div>';

    // Link if external
    if (item.url) {
        var domain = '';
        try { domain = new URL(item.url).hostname.replace('www.',''); } catch(e) {}
        h += '<a href="' + snEscape(item.url) + '" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:8px 16px;background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.3);border-radius:8px;color:var(--accent);font-size:0.8rem;text-decoration:none;margin-bottom:14px;word-break:break-all;">🔗 ' + snEscape(domain || item.url) + ' ↗</a>';
    }

    // Body text
    if (item.text) {
        h += '<div style="font-size:0.9rem;line-height:1.65;color:var(--text);word-break:break-word;">' + snRenderMarkdown(item.text) + '</div>';
    }

    // View on SN link
    h += '<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border);">';
    h += '<a href="https://stacker.news/items/' + item.id + '" target="_blank" rel="noopener noreferrer" style="color:var(--text-muted);font-size:0.75rem;text-decoration:none;">View on stacker.news ↗</a>';
    h += '</div>';

    h += '</div>'; // end post card

    // Comments
    if (item.comments && item.comments.comments && item.comments.comments.length > 0) {
        h += '<div style="margin-top:4px;">';
        h += '<div style="font-size:0.85rem;font-weight:700;color:var(--heading);margin-bottom:12px;">💬 Comments (' + item.ncomments + ')</div>';
        h += snRenderComments(item.comments.comments, 0);
        h += '</div>';
    }

    h += '</div>'; // end wrapper
    fc.innerHTML = h;
    fc.scrollTop = 0;
}

function snRenderComments(comments, depth) {
    var h = '';
    var maxDepth = 3;
    for (var i = 0; i < comments.length; i++) {
        var c = comments[i];
        var indent = Math.min(depth, maxDepth) * 16;
        h += '<div style="margin-left:' + indent + 'px;padding:12px 14px;border:1px solid var(--border);border-radius:10px;margin-bottom:6px;background:var(--card-bg);">';
        h += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;font-size:0.7rem;color:var(--text-muted);">';
        h += '<a href="https://stacker.news/' + snEscape(c.user.name) + '" target="_blank" rel="noopener noreferrer" style="font-weight:600;color:var(--text-muted);text-decoration:none;" onmouseover="this.style.color=\'var(--accent)\'" onmouseout="this.style.color=\'var(--text-muted)\'">@' + snEscape(c.user.name) + '</a>';
        h += '<span>·</span>';
        h += '<span>' + snTimeAgo(c.createdAt) + '</span>';
        if (c.sats > 0) {
            h += '<span>·</span>';
            h += '<span style="color:var(--accent);">⚡ ' + snFormatSats(c.sats) + '</span>';
        }
        h += '</div>';
        if (c.text) {
            h += '<div style="font-size:0.82rem;line-height:1.55;color:var(--text);word-break:break-word;">' + snRenderMarkdown(c.text) + '</div>';
        }
        h += '</div>';
        // Nested replies
        if (c.comments && c.comments.comments && c.comments.comments.length > 0) {
            h += snRenderComments(c.comments.comments, depth + 1);
        }
    }
    return h;
}

// Simple markdown-ish rendering for SN post text
function snRenderMarkdown(text) {
    if (!text) return '';
    var s = snEscape(text);
    // Headers
    s = s.replace(/^#{3}\s+(.+)$/gm, '<div style="font-size:1rem;font-weight:700;margin:14px 0 6px;color:var(--heading);">$1</div>');
    s = s.replace(/^#{2}\s+(.+)$/gm, '<div style="font-size:1.05rem;font-weight:700;margin:16px 0 8px;color:var(--heading);">$1</div>');
    s = s.replace(/^#{1}\s+(.+)$/gm, '<div style="font-size:1.1rem;font-weight:800;margin:18px 0 8px;color:var(--heading);">$1</div>');
    // Bold + italic
    s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Links: [text](url)
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:underline;">$1</a>');
    // Inline code
    s = s.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.06);padding:1px 5px;border-radius:4px;font-size:0.85em;">$1</code>');
    // Line breaks
    s = s.replace(/\n\n/g, '</p><p style="margin:10px 0;">');
    s = s.replace(/\n/g, '<br>');
    s = '<p style="margin:10px 0;">' + s + '</p>';
    return s;
}

function snTimeAgo(iso) {
    var diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
}

function snFormatSats(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
}

function snEscape(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// =============================================
// @ Mention System — Autocomplete + Render + Notifications
// =============================================

// ---- Render @mentions as clickable links ----
// Call AFTER fEsc() and AFTER URL linkification on already-escaped HTML
function forumRenderMentions(html) {
    if (!html || html.indexOf('@') === -1) return html;
    // Split on HTML tags to only process text nodes (avoids matching @mentions inside href/src attributes)
    return html.replace(/(<[^>]+>)|(@([a-zA-Z0-9_\-\.]{2,20}))/g, function(match, tag, mention, username) {
        if (tag) return tag; // HTML tag — pass through unchanged
        // It's an @mention in a text node
        return '<span class="forum-mention" onclick="forumMentionClick(\'' + username.replace(/'/g, '') + '\')">' + mention + '</span>';
    });
}

// ---- Click handler for @mention ----
window.forumMentionClick = function(username) {
    if (!username || typeof db === 'undefined') return;
    // Try exact match first
    db.collection('users').where('username', '==', username).limit(1).get()
        .then(function(snap) {
            if (!snap.empty) {
                if (typeof showUserProfile === 'function') showUserProfile(snap.docs[0].id);
            } else {
                // Fallback: case-insensitive
                db.collection('users').where('username_lower', '==', username.toLowerCase()).limit(1).get()
                    .then(function(snap2) {
                        if (!snap2.empty) {
                            if (typeof showUserProfile === 'function') showUserProfile(snap2.docs[0].id);
                        } else {
                            if (typeof showToast === 'function') showToast('User @' + username + ' not found');
                        }
                    }).catch(function() {});
            }
        }).catch(function() {});
};

// ---- Notify mentioned users on submit ----
// body = raw text, contextType = 'forum_post'|'article', contextId = doc id, contextTitle = post/article title
window.forumNotifyMentions = async function(body, contextType, contextId, contextTitle) {
    if (!body || typeof db === 'undefined' || !auth || !auth.currentUser) return;
    var mentions = body.match(/@([a-zA-Z0-9_\-\.]{2,20})/g);
    if (!mentions) return;
    // Deduplicate
    var seen = {};
    var unique = [];
    mentions.forEach(function(m) {
        var name = m.substring(1).toLowerCase();
        if (!seen[name]) { seen[name] = true; unique.push(m.substring(1)); }
    });
    var myUid = auth.currentUser.uid;
    var myName = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'Someone';
    var titleSnip = (contextTitle || '').substring(0, 40);
    for (var i = 0; i < unique.length; i++) {
        try {
            var snap = await db.collection('users').where('username', '==', unique[i]).limit(1).get();
            if (snap.empty) {
                snap = await db.collection('users').where('username_lower', '==', unique[i].toLowerCase()).limit(1).get();
            }
            if (!snap.empty) {
                var uid = snap.docs[0].id;
                if (uid !== myUid && typeof sendNotification === 'function') {
                    sendNotification(uid, 'mention', myName + ' mentioned you in "' + titleSnip + '"', contextType, contextId);
                }
            }
        } catch(e) { console.warn('[forum] Mention notify error:', e); }
    }
};

// ---- Autocomplete Dropdown ----
var _mentionState = {
    activeTextarea: null,
    dropdown: null,
    results: [],
    selectedIdx: -1,
    debounceTimer: null,
    query: ''
};

function mentionGetCursorMention(textarea) {
    var pos = textarea.selectionStart;
    var text = textarea.value.substring(0, pos);
    // Find the last @ that isn't preceded by a word char
    var match = text.match(/(^|[\s(])@([a-zA-Z0-9_\-\.]{1,20})$/);
    if (match) return { prefix: match[2], start: pos - match[2].length - 1 };
    // Also match @ at very start
    if (text.match(/^@([a-zA-Z0-9_\-\.]{1,20})$/)) {
        var m = text.match(/^@([a-zA-Z0-9_\-\.]{1,20})$/);
        return { prefix: m[1], start: 0 };
    }
    return null;
}

function mentionShowDropdown(textarea, users) {
    mentionHideDropdown();
    if (!users || users.length === 0) return;
    _mentionState.results = users;
    _mentionState.selectedIdx = 0;

    var dd = document.createElement('div');
    dd.id = 'mentionDropdown';
    dd.style.cssText = 'position:absolute;z-index:9999;background:var(--card-bg,#1a1a2e);border:1px solid var(--border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.4);overflow:hidden;max-height:220px;overflow-y:auto;min-width:200px;';

    users.forEach(function(u, idx) {
        var item = document.createElement('div');
        item.className = 'mention-item';
        item.setAttribute('data-idx', idx);
        var lv = typeof getLevel === 'function' ? getLevel(u.points || 0) : { emoji: '🟢' };
        item.innerHTML = '<span style="font-size:0.85rem;">' + lv.emoji + '</span> ' +
            '<span style="font-weight:700;">' + fEsc(u.username) + '</span>' +
            (u.points ? '<span style="color:var(--text-faint);font-size:0.7rem;margin-left:6px;">' + (u.points || 0).toLocaleString() + ' XP</span>' : '');
        item.style.cssText = 'padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:0.85rem;color:var(--text);transition:background 0.15s;' +
            (idx === 0 ? 'background:var(--accent-bg);' : '');
        item.onmouseenter = function() {
            _mentionState.selectedIdx = idx;
            mentionHighlight();
        };
        item.onmousedown = function(e) {
            e.preventDefault(); // prevent textarea blur
            mentionSelect(idx);
        };
        dd.appendChild(item);
    });

    // Position below textarea
    var rect = textarea.getBoundingClientRect();
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    dd.style.position = 'fixed';
    dd.style.left = rect.left + 'px';
    dd.style.top = (rect.bottom + 4) + 'px';
    dd.style.width = Math.min(rect.width, 320) + 'px';

    document.body.appendChild(dd);
    _mentionState.dropdown = dd;
}

function mentionHighlight() {
    var dd = _mentionState.dropdown;
    if (!dd) return;
    var items = dd.querySelectorAll('.mention-item');
    items.forEach(function(el, i) {
        el.style.background = i === _mentionState.selectedIdx ? 'var(--accent-bg)' : '';
    });
}

function mentionHideDropdown() {
    if (_mentionState.dropdown) {
        _mentionState.dropdown.remove();
        _mentionState.dropdown = null;
    }
    _mentionState.results = [];
    _mentionState.selectedIdx = -1;
}

function mentionSelect(idx) {
    var user = _mentionState.results[idx];
    var textarea = _mentionState.activeTextarea;
    if (!user || !textarea) return;

    var info = mentionGetCursorMention(textarea);
    if (!info) { mentionHideDropdown(); return; }

    var before = textarea.value.substring(0, info.start);
    var after = textarea.value.substring(textarea.selectionStart);
    var insert = '@' + user.username + ' ';
    textarea.value = before + insert + after;
    var newPos = before.length + insert.length;
    textarea.selectionStart = textarea.selectionEnd = newPos;
    textarea.focus();
    mentionHideDropdown();
}

function mentionQueryUsers(prefix) {
    if (!prefix || prefix.length < 2 || typeof db === 'undefined') {
        mentionHideDropdown();
        return;
    }
    // Query multiple case variants since username field is case-sensitive
    var variants = [prefix];
    var low = prefix.toLowerCase();
    var cap = prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase();
    if (low !== prefix) variants.push(low);
    if (cap !== prefix && cap !== low) variants.push(cap);

    var allUsers = [];
    var seen = {};
    var done = 0;

    variants.forEach(function(v) {
        db.collection('users')
            .where('username', '>=', v)
            .where('username', '<=', v + '\uf8ff')
            .limit(5)
            .get()
            .then(function(snap) {
                snap.forEach(function(doc) {
                    var d = doc.data();
                    if (d.username && !seen[doc.id]) {
                        seen[doc.id] = true;
                        allUsers.push({ uid: doc.id, username: d.username, points: d.points || 0 });
                    }
                });
            })
            .catch(function() {})
            .then(function() {
                done++;
                if (done >= variants.length) {
                    // Sort by points descending for relevance
                    allUsers.sort(function(a, b) { return (b.points || 0) - (a.points || 0); });
                    if (_mentionState.activeTextarea) mentionShowDropdown(_mentionState.activeTextarea, allUsers.slice(0, 5));
                }
            });
    });
}

function mentionBindTextarea(textarea) {
    if (!textarea || textarea._mentionBound) return;
    textarea._mentionBound = true;

    textarea.addEventListener('input', function() {
        _mentionState.activeTextarea = textarea;
        var info = mentionGetCursorMention(textarea);
        if (!info || info.prefix.length < 2) {
            mentionHideDropdown();
            return;
        }
        // Debounce
        clearTimeout(_mentionState.debounceTimer);
        _mentionState.debounceTimer = setTimeout(function() {
            mentionQueryUsers(info.prefix);
        }, 300);
    });

    textarea.addEventListener('keydown', function(e) {
        if (!_mentionState.dropdown) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            _mentionState.selectedIdx = Math.min(_mentionState.selectedIdx + 1, _mentionState.results.length - 1);
            mentionHighlight();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            _mentionState.selectedIdx = Math.max(_mentionState.selectedIdx - 1, 0);
            mentionHighlight();
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            if (_mentionState.results.length > 0 && _mentionState.selectedIdx >= 0) {
                e.preventDefault();
                mentionSelect(_mentionState.selectedIdx);
            }
        } else if (e.key === 'Escape') {
            mentionHideDropdown();
        }
    });

    textarea.addEventListener('blur', function() {
        // Delay to allow mousedown on dropdown item
        setTimeout(mentionHideDropdown, 200);
    });
}

// ---- Auto-bind textareas via MutationObserver ----
function mentionObserveForTextareas() {
    var targetIds = ['forumNewBody', 'forumReplyInput', 'articleReplyInput'];
    // Bind any already in DOM
    targetIds.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) mentionBindTextarea(el);
    });
    // Watch for new ones
    if (typeof MutationObserver !== 'undefined') {
        var observer = new MutationObserver(function() {
            targetIds.forEach(function(id) {
                var el = document.getElementById(id);
                if (el) mentionBindTextarea(el);
            });
        });
        var fc = document.getElementById('forumContainer');
        if (fc) {
            observer.observe(fc, { childList: true, subtree: true });
        } else {
            // Forum container may not exist yet — watch body briefly
            var bodyObs = new MutationObserver(function() {
                var fc2 = document.getElementById('forumContainer');
                if (fc2) {
                    bodyObs.disconnect();
                    observer.observe(fc2, { childList: true, subtree: true });
                    targetIds.forEach(function(id) {
                        var el = document.getElementById(id);
                        if (el) mentionBindTextarea(el);
                    });
                }
            });
            bodyObs.observe(document.body, { childList: true, subtree: true });
        }
    }
}

// Inject mention CSS
var _mentionStyle = document.createElement('style');
_mentionStyle.textContent = '.forum-mention{color:var(--accent);cursor:pointer;font-weight:600;transition:opacity 0.15s;}.forum-mention:hover{opacity:0.8;text-decoration:underline;}';
document.head.appendChild(_mentionStyle);

// Init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(mentionObserveForTextareas, 1000); });
} else {
    setTimeout(mentionObserveForTextareas, 1000);
}

})();
