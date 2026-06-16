// =============================================
// 💬 Global Chat — Real-time chatroom for all users
// =============================================
!function() {
'use strict';

var CHAT_COLLECTION = 'global_chat';
var ANNOUNCEMENTS_COLLECTION = 'announcements';
var MAX_MSG_LENGTH = 300;
var RATE_LIMIT_MS = 3000; // 3 seconds between messages
var MAX_MSGS_DISPLAY = 100; // Fetch from Firestore
// Bridge: forward message to Telegram via Cloud Function (secret is server-side only)
function bridgeToTelegram(data) {
    try {
        if (typeof firebase !== 'undefined' && firebase.functions) {
            var bridgeMsg = firebase.functions().httpsCallable('bridgeToTelegram');
            bridgeMsg({
                user: data.user || data.name || 'Anon',
                text: data.text || '',
                gifUrl: data.gifUrl || '',
                imageUrl: data.imageUrl || '',
                imageBase64: data.imageBase64 || '',
                replyToName: data.replyToName || '',
                replyToText: data.replyToText || '',
                source: 'web'
            }).catch(function(e) { console.warn('[BRIDGE] Cloud Function call failed:', e.message); });
        }
    } catch(e) {}
}
var CHAT_INITIAL_SHOW = 20; // Render initially (reduced to save Firestore reads)
var CHAT_LOAD_MORE_COUNT = 20; // Per "load more" batch
var _chatUnsub = null;
var _lastSendTime = 0;
var _chatTab = 'global'; // 'global', 'announcements', or 'dms'
var _replyTo = null; // {_id, name, text} when replying
var _acType = null; // 'hash' or 'at' for autocomplete
var _acQuery = ''; // current autocomplete search
var _acStart = 0; // cursor position where trigger started
var _chatUsers = {}; // uid -> username cache from messages
var _acIndex = 0; // keyboard nav index
var REACT_EMOJIS_DEFAULT = ['👍','👎','❤️','😂','🔥','⚡','🤔','👀','🙌','💯'];
var REACT_EMOJIS_EXPANDED = ['👍','👎','❤️','😂','🔥','⚡','🤔','👀','🙌','💯','🦌','🎉','😢','😡','🤣','💀','🙏','💪','🤯','😱','🥳','😎','🤡','💎','🚀','⛏️','🧡','₿','🫡','👑','🐋','❌','✅','⬆️','⬇️','🍿','☠️','🫂','🤝','💩'];
var _reactExpanded = false;
var IMG_REGEX = /https?:\/\/[^\s<]+\.(?:gif|png|jpg|jpeg|webp)(\?[^\s<]*)?/i;
var GIF_HOSTS = /tenor\.com|giphy\.com|imgur\.com|gfycat\.com/i;

// Known apps/pages for # autocomplete
var HASH_TARGETS = [
    {tag:'forum', label:'PlebTalk Forum'},
    {tag:'marketplace', label:'Marketplace'},
    {tag:'bitcoin-beats', label:'Bitcoin Beats'},
    {tag:'irl-sync', label:'IRL Sync'},
    {tag:'dms', label:'Direct Messages'},
    {tag:'lightning', label:'Lightning'},
    {tag:'nacho', label:'Ask Nacho'},
    {tag:'pvp', label:'PVP Trivia'},
    {tag:'wallet', label:'Wallet'},
    {tag:'settings', label:'Settings'}
];
// Add channels dynamically from CHANNELS if available
function getHashTargets() {
    var targets = HASH_TARGETS.slice();
    if (typeof CHANNELS === 'object' && CHANNELS) {
        for (var k in CHANNELS) {
            if (CHANNELS[k] && CHANNELS[k].title) {
                // Strip emoji prefix for cleaner display
                var title = CHANNELS[k].title.replace(/^[\u{1F300}-\u{1FAD6}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}\u2764\u2705\u26A0\u2B50\u2934\u2935\u21A9\u21AA\u2194\u2195\u23F0\u23F3\u231A\u231B\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2611\u2622\u2623\u260E\u2615\u2660\u2663\u2665\u2666\u267B\u267F\u2693\u2696\u2697\u2699\u269B\u269C\u26A1\u26BD\u26BE\u26C4\u26C5\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0-\u26F5\u26F7\u26F8\u26F9\u26FA\u2702\u2708\u2709\u270A-\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763]+\s*/u, '');
                targets.push({tag: k, label: title || k});
            }
        }
    }
    return targets;
}

// Profanity filter
var BAD_WORDS = [
    // Profanity
    'fuck','shit','bitch','dick','cock','pussy','cunt','ass','bastard','slut','whore','penis','vagina','anal','cum','jizz','dildo','tits','boob','nude','naked','milf','orgasm','molest','wank','twat','piss','skank','thot','stfu','gtfo','incel',
    // Sexual content
    'blowjob','handjob','fingering','masturbat','threesome','gangbang','fetish','bondage','bdsm','kinky','horny','aroused','erection','erectile','climax','ejaculat','deepthroat','rimjob','creampie','cuckold','dominatrix','escort','prostitut','hooker','stripper','camgirl','sexting','nudes','send nudes','dick pic','twerk',
    // Hate speech / racism
    'nigger','nigga','fag','faggot','retard','retarded','nazi','hitler','kkk','spic','wetback','chink','gook','kike','towelhead','raghead','beaner','cracker','honky','coon','darkie','zipperhead','gringo','jap','paki','wop','dago',
    // Violence / threats
    'kill yourself','kys','rape','pedo','suicide','terrorist','jihad','murder','genocide','lynch','ethnic cleansing','gas the','death to',
    // Self-harm
    'cut myself','cutting myself','slit my wrist','hang myself','end my life','want to die','wanna die','kill myself','self harm','self-harm','overdose on','jump off',
    // Hate phrases
    'white power','white supremacy','heil','sieg heil','race war','great replacement','final solution','go back to your country','build the wall','deport them','they will not replace',
    // Religious hate
    'islamophob','christophob','antisemit','anti semit','zionist pig','crusade against','infidel','kafir','heathen scum','god hates',
    // Political extremism
    'maga','trump','biden','democrat','republican','liberal','conservative','left wing','right wing','antifa','proud boys','qanon','wwg1wga','lets go brandon','fjb','fjb',
    // Discrimination phrases
    'all cops','acab','defund','illegal alien','anchor baby',
    // Adult content
    'onlyfans','xnxx','pornhub','xvideos','porn','hentai'
];

// Hate/political phrase detection (multi-word patterns checked separately)
var HATE_PHRASES = [
    // Hate
    'kill yourself','white power','white supremacy','sieg heil','race war','great replacement','final solution','go back to your country','build the wall','death to','gas the','ethnic cleansing','god hates','they will not replace','lets go brandon',
    // Threats
    'i will kill','i will hurt','i will find you','i know where you live','watch your back','you are dead','gonna beat','gonna hurt','gonna kill','come find you','track you down','dox you','swat you',
    // Self-harm
    'kill myself','cut myself','cutting myself','slit my wrist','hang myself','end my life','want to die','wanna die','self harm','overdose on','jump off a',
    // Sexual
    'send nudes','dick pic','show me your','want to fuck','wanna fuck','lets fuck','have sex with','suck my','sit on my','bend over','get on your knees','sexually','sexual favor'
];
function containsProfanity(text) {
    var lower = text.toLowerCase().replace(/[0-9@$!*_\-]/g, function(c) {
        return {'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','@':'a','$':'s','!':'i','*':''}[c] || c;
    });
    // Check multi-word hate phrases first
    for (var p = 0; p < HATE_PHRASES.length; p++) {
        if (lower.includes(HATE_PHRASES[p])) return true;
    }
    // Check individual bad words
    var words = lower.split(/\s+/);
    for (var i = 0; i < BAD_WORDS.length; i++) {
        // Exact word match
        for (var w = 0; w < words.length; w++) {
            if (words[w] === BAD_WORDS[i]) return true;
        }
        // Embedded match for longer words (4+ chars)
        if (BAD_WORDS[i].length >= 4 && lower.includes(BAD_WORDS[i])) return true;
    }
    return false;
}

// Spam detection: repeated messages, all caps, link spam
function isSpammy(text) {
    if (text.length > 0 && text === text.toUpperCase() && text.length > 20) return true; // ALL CAPS
    if ((text.match(/https?:\/\//g) || []).length > 2) return true; // Too many links
    if (/(.)\1{6,}/.test(text)) return true; // Repeated characters (aaaaaaa)
    return false;
}

// Escape HTML
function esc(s) { return s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }

// Time format
function timeAgo(ts) {
    if (!ts) return '';
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    var now = Date.now();
    var diff = Math.floor((now - d.getTime()) / 1000);
    if (diff < 60) return 'now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ---- Render Chat Hub (tabbed: Global Chat | DMs) ----
window.renderChatHub = function(initialTab) {
    _chatTab = initialTab || 'global';

    var container = document.getElementById('forumContainer');
    if (!container) return;

    // Hide other views
    document.getElementById('home').classList.add('hidden');
    document.getElementById('hero').style.display = 'none';
    document.getElementById('msgs').style.display = 'none';
    container.style.display = 'block';

    var html = '<div style="max-width:600px;margin:0 auto;padding:0;height:calc(100dvh - 120px - env(safe-area-inset-top, 0px));height:calc(100vh - 120px - env(safe-area-inset-top, 0px));display:flex;flex-direction:column;">';

    // Tab bar — compact labels so all 4 tabs + Rules fit
    var _tA = function(t) { return t === _chatTab ? 'var(--accent)' : 'var(--text-muted)'; };
    var _tB = function(t) { return t === _chatTab ? 'var(--accent)' : 'transparent'; };
    html += '<div style="display:flex;border-bottom:1px solid var(--border);flex-shrink:0;background:var(--bg-side);">';
    html += '<button id="chatTabGlobal" onclick="switchChatTab(\'global\')" style="flex:1;padding:12px 0;background:none;border:none;border-bottom:2px solid ' + _tB('global') + ';color:' + _tA('global') + ';font-size:0.78rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">🌍 Global</button>';
    html += '<button id="chatTabAnnouncements" onclick="switchChatTab(\'announcements\')" style="flex:1;padding:12px 0;background:none;border:none;border-bottom:2px solid ' + _tB('announcements') + ';color:' + _tA('announcements') + ';font-size:0.78rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">📣 News</button>';
    html += '<button id="chatTabDMs" onclick="switchChatTab(\'dms\')" style="flex:1;padding:12px 0;background:none;border:none;border-bottom:2px solid ' + _tB('dms') + ';color:' + _tA('dms') + ';font-size:0.78rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">✉️ DMs</button>';
    html += '<button onclick="showChatRules()" style="padding:12px 8px;background:none;border:none;border-bottom:2px solid transparent;color:var(--text-faint);font-size:0.72rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;white-space:nowrap;">📋 Rules</button>';
    html += '</div>';

    // Content area
    html += '<div id="chatContent" style="flex:1;overflow:hidden;display:flex;flex-direction:column;"></div>';
    html += '</div>';

    container.innerHTML = html;

    if (_chatTab === 'global') {
        renderGlobalChat();
    } else {
        renderDMsTab();
    }

    // Push history state
    history.pushState({ channel: 'chat' }, '', '#chat');

    // Update bottom nav
    if (typeof setFloatingElementsVisible === 'function') setFloatingElementsVisible(true);
};

window.switchChatTab = function(tab) {
    _chatTab = tab;

    // Update tab styles for all tabs
    ['Global', 'Announcements', 'DMs'].forEach(function(t) {
        var btn = document.getElementById('chatTab' + t);
        var key = t.toLowerCase();
        if (btn) {
            btn.style.borderBottomColor = tab === key ? 'var(--accent)' : 'transparent';
            btn.style.color = tab === key ? 'var(--accent)' : 'var(--text-muted)';
        }
    });

    // Unsubscribe from global chat listener when switching away
    if (tab !== 'global' && _chatUnsub) {
        _chatUnsub();
        _chatUnsub = null;
    }

    if (tab === 'global') {
        renderGlobalChat();
    } else if (tab === 'announcements') {
        renderAnnouncementsTab();
    } else {
        renderDMsTab();
    }
};

// ---- Global Chat ----
function renderGlobalChat() {
    var content = document.getElementById('chatContent');
    if (!content) return;

    var isSignedIn = typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous;
    var hasUsername = typeof currentUser !== 'undefined' && currentUser && currentUser.username;

    content.innerHTML =
        '<div id="globalChatMessages" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 16px;display:flex;flex-direction:column;gap:6px;min-height:0;">' +
            '<div style="text-align:center;padding:20px;color:var(--text-faint);font-size:0.75rem;">Loading chat...</div>' +
        '</div>' +
        '<div style="flex-shrink:0;padding:10px 16px;border-top:1px solid var(--border);background:var(--bg-side);">' +
            (hasUsername ?
                '<div id="chatReplyBanner" style="display:none;padding:6px 12px;background:rgba(99,102,241,0.1);border-left:3px solid #6366f1;border-radius:6px;margin-bottom:6px;font-size:0.75rem;color:var(--text-muted);position:relative;">Replying to <strong id="chatReplyName"></strong>: <span id="chatReplyPreview"></span><span onclick="cancelReply()" style="position:absolute;right:8px;top:4px;cursor:pointer;font-size:0.9rem;color:var(--text-faint);">✕</span></div>' +
                '<div style="position:relative;">' +
                    '<div id="chatAutocomplete" style="display:none;position:absolute;bottom:100%;left:0;right:0;max-height:180px;overflow-y:auto;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;margin-bottom:4px;box-shadow:0 -4px 16px rgba(0,0,0,0.3);z-index:10;"></div>' +
                    '<div style="display:flex;gap:6px;align-items:center;">' +
                        '<button onclick="sendGlobalChat()" style="padding:10px 14px;background:var(--accent);color:#fff;border:none;border-radius:20px;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;flex-shrink:0;touch-action:manipulation;">Send</button>' +
                        '<input type="text" id="globalChatInput" placeholder="Say something..." maxlength="' + MAX_MSG_LENGTH + '" style="flex:1;min-width:0;padding:12px 14px;background:var(--input-bg);border:1px solid var(--border);border-radius:20px;color:var(--text);font-size:16px;font-family:inherit;outline:none;box-sizing:border-box;" autocomplete="off">' +
                        '<button onclick="showEmojiPicker()" style="padding:6px;background:none;border:none;font-size:1.1rem;cursor:pointer;flex-shrink:0;color:var(--text-faint);touch-action:manipulation;" title="Emoji">😀</button>' +
                        '<button onclick="chatUploadImage()" style="padding:6px;background:none;border:none;font-size:1.1rem;cursor:pointer;flex-shrink:0;color:var(--text-faint);touch-action:manipulation;" title="Upload Image">📷</button>' +
                        '<button onclick="showGifPicker()" style="padding:6px;background:none;border:none;font-size:0.75rem;font-weight:700;cursor:pointer;flex-shrink:0;color:var(--text-faint);touch-action:manipulation;" title="Send GIF">GIF</button>' +
                    '</div>' +
                '</div>' +
                '<div style="text-align:right;font-size:0.6rem;color:var(--text-faint);margin-top:3px;"><span id="globalChatCharCount">0</span>/' + MAX_MSG_LENGTH + '</div>'
            :
                '<div style="text-align:center;padding:8px;color:var(--text-muted);font-size:0.8rem;">' +
                    (isSignedIn ? 'Set a username in <a href="#" onclick="if(typeof showSettings===\'function\')showSettings();return false;" style="color:var(--accent);">Settings</a> to chat' :
                    '<button onclick="if(typeof showUsernamePrompt===\'function\')showUsernamePrompt()" style="padding:10px 20px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.85rem;">Sign up to join the chat</button>') +
                '</div>'
            ) +
        '</div>';

    // Input handling: character counter + autocomplete + paste
    var input = document.getElementById('globalChatInput');
    if (input) {
        input.addEventListener('paste', handlePaste);
        input.addEventListener('input', function() {
            var counter = document.getElementById('globalChatCharCount');
            if (counter) counter.textContent = this.value.length;
            handleAutocomplete(this);
        });
        input.addEventListener('keydown', function(e) {
            var ac = document.getElementById('chatAutocomplete');
            if (ac && ac.style.display !== 'none') {
                var items = ac.querySelectorAll('.ac-item');
                if (e.key === 'ArrowDown') { e.preventDefault(); _acIndex = Math.min(_acIndex + 1, items.length - 1); highlightAC(items); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); _acIndex = Math.max(_acIndex - 1, 0); highlightAC(items); }
                else if (e.key === 'Enter' || e.key === 'Tab') {
                    if (items.length > 0) { e.preventDefault(); selectAC(items[_acIndex]); return; }
                }
                else if (e.key === 'Escape') { hideAC(); return; }
            }
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendGlobalChat(); }
        });
    }

    // Start listening for messages
    startChatListener();
}

function startChatListener() {
    if (_chatUnsub) { _chatUnsub(); _chatUnsub = null; }

    if (typeof db === 'undefined' || !db) {
        var el = document.getElementById('globalChatMessages');
        if (el) el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-faint);font-size:0.8rem;">Connecting to chat...</div>';
        // Retry when Firestore loads
        var _chatRetries = 0;
        var _chatRetryTimer = setInterval(function() {
            _chatRetries++;
            if (typeof db !== 'undefined' && db) { clearInterval(_chatRetryTimer); startChatListener(); }
            else if (_chatRetries > 15) { clearInterval(_chatRetryTimer); if (el) el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-faint);font-size:0.8rem;">Chat unavailable — please refresh the page.</div>'; }
        }, 2000);
        return;
    }

    window._chatShowCount = 0; // Reset on fresh load
    // Use orderBy('ts','asc') + limitToLast(N) so Firestore returns the N most recent
    // messages in chronological order (oldest first, newest last). This means:
    // - No .reverse() needed — messages arrive in render order
    // - New messages append naturally at the bottom (no phantom deletions)
    // - limitToLast correctly pages back when loadEarlierMessages is called
    _chatUnsub = db.collection(CHAT_COLLECTION)
        .where('isNachoAuto', '==', false)
        .orderBy('ts', 'asc')
        .limitToLast(CHAT_INITIAL_SHOW)
        .onSnapshot(function(snapshot) {
            var msgs = [];
            snapshot.forEach(function(doc) {
                var d = doc.data();
                d._id = doc.id;
                msgs.push(d);
            });
            // msgs is already oldest→newest — no reverse needed
            renderChatMessages(msgs);
        }, function(err) {
            // Fallback: query without the isNachoAuto filter (index may not exist yet)
            console.warn('[CHAT] Filtered query failed, falling back:', err.message);
            _chatUnsub = db.collection(CHAT_COLLECTION)
                .orderBy('ts', 'asc')
                .limitToLast(CHAT_INITIAL_SHOW)
                .onSnapshot(function(snapshot) {
                    var msgs = [];
                    snapshot.forEach(function(doc) {
                        var d = doc.data();
                        d._id = doc.id;
                        // Filter out Nacho auto-messages client-side as fallback
                        if (!d.isNachoAuto) msgs.push(d);
                    });
                    // already oldest→newest
                    renderChatMessages(msgs);
                }, function(err2) {
                    console.error('[CHAT] Listener error:', err2);
                    var el = document.getElementById('globalChatMessages');
                    if (el) el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-faint);font-size:0.8rem;">Chat connection lost. Refresh to retry.</div>';
                });
        });
}

window._chatAllMsgs = [];
window._chatShowCount = 0;

function renderChatMessages(msgs) {
    var el = document.getElementById('globalChatMessages');
    if (!el) return;

    window._chatAllMsgs = msgs;
    // On first render or new messages, show last CHAT_INITIAL_SHOW
    // If user already loaded more, keep their expanded view
    if (!window._chatShowCount || window._chatShowCount < CHAT_INITIAL_SHOW) {
        window._chatShowCount = CHAT_INITIAL_SHOW;
    }
    // If new messages came in, keep showing at least what we had
    var showCount = Math.min(window._chatShowCount, msgs.length);
    var visibleMsgs = msgs.slice(Math.max(0, msgs.length - showCount));
    // Show "load more" if we haven't hit the beginning yet
    var hasMore = !window._chatReachedBeginning && (msgs.length >= CHAT_INITIAL_SHOW || msgs.length > showCount);

    var myUid = (typeof auth !== 'undefined' && auth && auth.currentUser) ? auth.currentUser.uid : null;
    var _adminEmails = ['needcreations@gmail.com', 'info.603btc@gmail.com'];
    var isAdmin = myUid && typeof auth !== 'undefined' && auth.currentUser && _adminEmails.indexOf(auth.currentUser.email) !== -1;
    var wasAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;

    if (msgs.length === 0) {
        el.innerHTML = '<div style="text-align:center;padding:40px 20px;"><div style="font-size:2rem;margin-bottom:8px;">🌍</div><div style="color:var(--text-muted);font-size:0.85rem;">No messages yet. Be the first to say something!</div></div>';
        return;
    }

    // Cache usernames for @mention autocomplete
    for (var u = 0; u < visibleMsgs.length; u++) {
        if (visibleMsgs[u].uid && visibleMsgs[u].name && visibleMsgs[u].uid !== 'nacho-bot') {
            _chatUsers[visibleMsgs[u].uid] = visibleMsgs[u].name;
        }
    }

    var html = '';

    // "Load earlier" button at top
    if (hasMore) {
        html += '<div id="chatLoadMore" onclick="loadEarlierMessages()" style="padding:12px;text-align:center;cursor:pointer;color:var(--accent);font-size:0.8rem;font-weight:600;border-bottom:1px solid var(--border);opacity:0.8;transition:0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.8">↑ Load earlier messages</div>';
    }

    var lastDate = '';
    for (var i = 0; i < visibleMsgs.length; i++) {
        var m = visibleMsgs[i];
        var isMe = m.uid === myUid;
        var dateStr = m.ts ? (m.ts.toDate ? m.ts.toDate() : new Date(m.ts)).toLocaleDateString() : '';

        if (dateStr !== lastDate) {
            html += '<div style="text-align:center;margin:8px 0;"><span style="background:var(--card-bg);border:1px solid var(--border);padding:3px 10px;border-radius:10px;font-size:0.65rem;color:var(--text-faint);">' + dateStr + '</span></div>';
            lastDate = dateStr;
        }

        var isNacho = m.uid === 'nacho-bot' || m.isNachoAuto === true;
        var _factionStyle = !isNacho && m.faction ? window._factionNameStyle(m.faction) : '';
        var nameColor = isNacho ? '#22c55e' : isMe ? 'var(--accent)' : '#6366f1';
        var bubbleBg = isNacho ? 'rgba(34,197,94,0.06)' : isMe ? 'var(--accent-bg,rgba(247,147,26,0.08))' : 'var(--card-bg)';
        var bubbleBorder = isNacho ? 'rgba(34,197,94,0.2)' : isMe ? 'rgba(247,147,26,0.2)' : 'var(--border)';
        var align = isMe && !isNacho ? 'flex-end' : 'flex-start';
        // Override display name for Nacho auto-replies
        if (isNacho && m.name !== '🦌 Nacho') m.name = '🦌 Nacho';

        html += '<div data-msg-id="' + m._id + '" style="display:flex;flex-direction:column;align-items:' + align + ';max-width:85%;">';
        html += '<div style="background:' + bubbleBg + ';border:1px solid ' + bubbleBorder + ';border-radius:' + (isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px') + ';padding:8px 12px;position:relative;">';
        html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">';
        html += '<span style="font-weight:700;font-size:0.75rem;' + (_factionStyle || ('color:' + nameColor)) + ';cursor:pointer;" onclick="if(typeof showUserProfile===\'function\')showUserProfile(\'' + (m.uid || '') + '\')">' + (m.source === 'telegram' ? '📱 ' : '') + esc(m.name || 'Anon') + (m.userTag ? ' <span style="font-weight:400;color:var(--text-faint);font-size:0.65rem;">' + esc(m.userTag) + '</span>' : '') + '</span>';
        html += '<span style="font-size:0.6rem;color:var(--text-faint);">' + timeAgo(m.ts) + '</span>';
        if (myUid) {
            html += '<span onclick="setChatReply(\'' + m._id + '\',\'' + esc(m.name || 'Anon').replace(/[\\'"]/g,'') + '\',\'' + esc((m.text||'').substring(0,50)).replace(/[\\'"]/g,'') + '\')" style="cursor:pointer;font-size:0.6rem;color:var(--text-faint);margin-left:auto;opacity:0.5;transition:0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.5" title="Reply">↩️</span>';
        }
        if (isMe || isAdmin) {
            html += '<span onclick="deleteChatMsg(\'' + m._id + '\')" style="cursor:pointer;font-size:0.6rem;color:#ef4444;margin-left:4px;opacity:0.5;transition:0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.5" title="Delete">🗑️</span>';
        }
        html += '</div>';
        if (m.replyToName) {
            var _replyId = m.replyTo || '';
            html += '<div onclick="window._scrollToChatMsg(\'' + _replyId + '\')" style="padding:5px 10px;margin-bottom:6px;border-left:3px solid #6366f1;font-size:0.72rem;color:var(--text);border-radius:4px;background:rgba(99,102,241,0.12);cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background=\'rgba(99,102,241,0.22)\'" onmouseout="this.style.background=\'rgba(99,102,241,0.12)\'">';
            html += '<span style="font-weight:700;color:#818cf8;font-size:0.7rem;display:block;margin-bottom:1px;">' + esc(m.replyToName) + '</span>';
            html += '<span style="color:var(--text-muted);">' + esc((m.replyToText||'').substring(0,80)) + (m.replyToText && m.replyToText.length > 80 ? '…' : '') + '</span>';
            html += '</div>';
        }
        if (m.isGif && m.text && (IMG_REGEX.test(m.text) || /^data:image\/(jpeg|jpg|png|gif|webp);base64,/.test(m.text))) {
            html += '<img src="' + esc(m.text) + '" onclick="enlargeChatImage(this.src)" style="max-width:100%;max-height:200px;border-radius:8px;margin-top:2px;display:block;cursor:pointer;" loading="lazy">';
        } else if (m.imageUrl || m.gifUrl) {
            var mediaSrc = m.imageUrl || m.gifUrl;
            if (m.text) html += '<div style="color:var(--text);font-size:0.85rem;line-height:1.5;word-break:break-word;margin-bottom:4px;">' + formatChatText(esc(m.text), m.mentionUid) + '</div>';
            if (m.gifUrl && /\.mp4(\?|$)/i.test(mediaSrc)) {
                // Telegram MP4 animations need a video element, not img
                html += '<video src="' + esc(mediaSrc) + '" autoplay loop muted playsinline style="max-width:100%;max-height:200px;border-radius:8px;margin-top:2px;display:block;" onerror="this.style.display=\'none\'"></video>';
            } else {
                html += '<img src="' + esc(mediaSrc) + '" onclick="enlargeChatImage(this.src)" style="max-width:100%;max-height:200px;border-radius:8px;margin-top:2px;display:block;cursor:pointer;" loading="lazy" onerror="this.style.display=\'none\'">';
            };
        } else {
            html += '<div style="color:var(--text);font-size:0.85rem;line-height:1.5;word-break:break-word;">' + formatChatText(esc(m.text || ''), m.mentionUid) + '</div>';
        }
        var reactions = m.reactions || {};
        var hasReactions = Object.keys(reactions).length > 0;
        html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:' + (hasReactions ? '4px' : '0') + ';">';
        for (var emoji in reactions) {
            // Validate: reaction keys must be 1-4 char emoji only (no HTML/scripts)
            if (!emoji || emoji.length > 10 || /[<>"'\\&;(){}]/.test(emoji)) continue;
            var users = reactions[emoji] || [];
            var count = users.length;
            if (count === 0) continue;
            var iReacted = myUid && users.indexOf(myUid) !== -1;
            var safeEmoji = esc(emoji);
            html += '<button onclick="toggleReaction(\'' + m._id + '\',\'' + safeEmoji.replace(/[\\'"]/g, '') + '\')" style="padding:2px 6px;border-radius:10px;font-size:0.7rem;cursor:pointer;border:1px solid ' + (iReacted ? 'var(--accent)' : 'var(--border)') + ';background:' + (iReacted ? 'rgba(247,147,26,0.1)' : 'var(--card-bg)') + ';color:var(--text);font-family:inherit;display:flex;align-items:center;gap:2px;touch-action:manipulation;">' + safeEmoji + '<span style="font-size:0.6rem;color:var(--text-muted);">' + count + '</span></button>';
        }
        if (myUid) {
            html += '<button onclick="showReactPicker(\'' + m._id + '\',this)" style="padding:2px 6px;border-radius:10px;font-size:0.65rem;cursor:pointer;border:1px solid var(--border);background:var(--card-bg);color:var(--text-faint);font-family:inherit;opacity:0.4;transition:0.2s;touch-action:manipulation;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.4" title="React">+😀</button>';
            if (!isMe && !isNacho && m.uid !== 'system') {
                html += '<button onclick="event.stopPropagation();showTipOverlay({recipientName:\'' + esc(m.name || 'Anon').replace(/[\\'"]/g,'') + '\',recipientUid:\'' + (m.uid || '') + '\',context:\'Global Chat tip\',label:\'Tip Message\'})" style="padding:2px 6px;border-radius:10px;font-size:0.65rem;cursor:pointer;border:1px solid rgba(234,179,8,0.2);background:rgba(234,179,8,0.05);color:#eab308;font-family:inherit;opacity:0.4;transition:0.2s;touch-action:manipulation;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.4" title="Tip">⚡</button>';
            }
        }
        html += '</div>';
        html += '</div></div>';
    }

    el.innerHTML = html;

    // Auto-scroll to bottom if user was near bottom
    if (wasAtBottom) {
        setTimeout(function() { el.scrollTop = el.scrollHeight; }, 50);
    }
    // Always scroll to bottom on first render (no user scroll yet)
    if (!el._userScrolled) {
        setTimeout(function() { el.scrollTop = el.scrollHeight; }, 100);
    }
    if (!el._scrollListenerAdded) {
        el._scrollListenerAdded = true;
        el._loadingMore = false;
        el.addEventListener('scroll', function() {
            el._userScrolled = true;
            // Auto-load earlier messages when scrolled near top
            if (el.scrollTop < 80 && !el._loadingMore && !window._chatReachedBeginning && typeof loadEarlierMessages === 'function') {
                var btn = document.getElementById('chatLoadMore');
                if (btn) {
                    el._loadingMore = true;
                    loadEarlierMessages();
                    setTimeout(function() { el._loadingMore = false; }, 1500);
                }
            }
        });
    }
}

// Load earlier messages from Firestore
window.loadEarlierMessages = function() {
    var btn = document.getElementById('chatLoadMore');
    if (btn) btn.innerHTML = '⏳ Loading...';
    if (!window._chatAllMsgs || window._chatAllMsgs.length === 0) return;
    var oldest = window._chatAllMsgs[0];
    if (!oldest || !oldest.ts) return;
    var el = document.getElementById('globalChatMessages');
    var oldHeight = el ? el.scrollHeight : 0;

    // With asc ordering + limitToLast, "earlier" messages are those BEFORE the oldest
    // we currently have. Use endBefore(oldest.ts) + limitToLast to page backward.
    db.collection(CHAT_COLLECTION)
        .orderBy('ts', 'asc')
        .endBefore(oldest.ts)
        .limitToLast(CHAT_LOAD_MORE_COUNT)
        .get().then(function(snap) {
            var older = [];
            snap.forEach(function(doc) {
                var d = doc.data();
                d._id = doc.id;
                older.push(d);
            });
            // snap is already oldest→newest — no reverse needed
            if (older.length > 0) {
                window._chatAllMsgs = older.concat(window._chatAllMsgs);
                window._chatShowCount = window._chatAllMsgs.length;
                renderChatMessages(window._chatAllMsgs);
                // Preserve scroll position
                if (el) {
                    setTimeout(function() {
                        el.scrollTop = el.scrollHeight - oldHeight;
                    }, 50);
                }
            } else {
                window._chatReachedBeginning = true;
                if (btn) btn.innerHTML = '— Beginning of chat —';
            }
        }).catch(function() {
            if (btn) btn.innerHTML = '↑ Load earlier messages';
        });
};

// Format chat text: links, #channels, @mentions, inline images/GIFs
function formatChatText(text, mentionUid) {
    // Inline images/GIFs: render as image if it's a direct image URL
    text = text.replace(/(https?:\/\/[^\s<]+\.(?:gif|png|jpg|jpeg|webp)(?:\?[^\s<]*)?)/gi, function(url) {
        return '<a href="' + url + '" target="_blank" rel="noopener"><img src="' + url + '" style="max-width:100%;max-height:200px;border-radius:8px;margin-top:4px;display:block;cursor:pointer;" loading="lazy" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'inline\'"><span style="display:none;color:var(--accent);word-break:break-all;">' + url + '</span></a>';
    });
    // Regular URLs (non-image)
    text = text.replace(/(https?:\/\/[^\s<]+)(?![^<]*<\/a>)/g, '<a href="$1" target="_blank" rel="noopener" style="color:var(--accent);word-break:break-all;">$1</a>');
    // Markdown-style in-app links: [Link Text](#route)
    // Store placeholders to survive the on* sanitizer, then restore after
    var _inAppLinks = [];
    var _safeMentions = [];
    text = text.replace(/\[([^\]]+)\]\(#([a-zA-Z0-9_-]+)\)/g, function(match, label, route) {
        var _action = route === 'pvp' ? "event.preventDefault();if(typeof enterPVPMode==='function')enterPVPMode();"
                     : route === 'nacho' ? "event.preventDefault();if(typeof enterNachoMode==='function')enterNachoMode();"
                     : route === 'quests' ? "event.preventDefault();if(typeof showQuestHub==='function')showQuestHub();"
                     : route === 'favor' ? "event.preventDefault();if(typeof showQuestHub==='function')showQuestHub();window._questHubTab='favor';setTimeout(function(){if(typeof _renderQuestHubTab==='function')_renderQuestHubTab();},100);"
                     : "event.preventDefault();if(typeof go==='function')go('" + route + "');";
        var placeholder = '%%INAPPLINK_' + _inAppLinks.length + '%%';
        _inAppLinks.push('<a href="#' + route + '" onclick="' + _action + '" style="color:#6366f1;font-weight:700;text-decoration:none;cursor:pointer;">' + label + '</a>');
        return placeholder;
    });
    // #channel tags — skip matches inside HTML attributes (href, onclick, style, etc.)
    text = text.replace(/(<[^>]*>)|(#([a-zA-Z0-9_-]+))/g, function(match, htmlTag, hashMatch, tag) {
        if (htmlTag) return htmlTag; // Pass HTML tags through unchanged
        return '<a href="#' + tag + '" onclick="event.preventDefault();if(typeof go===\'function\')go(\'' + tag + '\');" style="color:#6366f1;font-weight:700;text-decoration:none;cursor:pointer;">#' + tag + '</a>';
    });
    // @mentions — clickable to open user profile
    var _mentionHandled = false;
    if (mentionUid) {
        // If we have a direct uid (from level-up announcements etc), use it for the first @mention
        text = text.replace(/@([a-zA-Z0-9_ ]+?)(?= just | leveled| earned| completed| aced|[!.,;:?]|$)/, function(match, name) {
            _mentionHandled = true;
            var safeName = name.trim();
            var placeholder = '%%SAFEMENTION_' + _safeMentions.length + '%%';
            _safeMentions.push('<span style="color:#6366f1;font-weight:700;cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px;" onclick="if(typeof showUserProfile===\'function\')showUserProfile(\'' + mentionUid + '\')" title="View profile — tap to tip!">@' + safeName + '</span>');
            return placeholder;
        });
    }
    // Handle remaining @mentions without uid (user-typed)
    text = text.replace(/@([a-zA-Z0-9_]+)/g, function(match, name) {
        var safeName = name.replace(/[\\'"/]/g, '').trim();
        if (!safeName) return match;
        var placeholder = '%%SAFEMENTION_' + _safeMentions.length + '%%';
        _safeMentions.push('<span style="color:#6366f1;font-weight:700;cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px;" onclick="if(typeof lookupUserByName===\'function\')lookupUserByName(\'' + safeName + '\')" title="View profile">@' + safeName + '</span>');
        return placeholder;
    });
    // H1: Post-transform sanitization
    // Block javascript:/data:/vbscript: in href/src attributes
    text = text.replace(/(?:href|src)\s*=\s*["']?\s*(?:javascript|data|vbscript):/gi, 'href="about:blank" data-blocked="');
    // Strip tags except safe allowlist (a, span, img, strong, em, br)
    text = text.replace(/<(?!\/?(?:a\b|span\b|img\b|strong\b|em\b|br\b))[^>]*>/gi, '');
    // Remove on* event handlers (from user-injected content)
    text = text.replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '');
    // Restore in-app link placeholders (these are safe, generated by us)
    for (var _li = 0; _li < _inAppLinks.length; _li++) {
        text = text.replace('%%INAPPLINK_' + _li + '%%', _inAppLinks[_li]);
    }
    // Restore @mention placeholders (safe, generated by us with verified uid)
    for (var _mi = 0; _mi < _safeMentions.length; _mi++) {
        text = text.replace('%%SAFEMENTION_' + _mi + '%%', _safeMentions[_mi]);
    }
    return text;
}

// ---- Autocomplete Engine ----
function handleAutocomplete(input) {
    var val = input.value;
    var cursor = input.selectionStart;
    // Search backwards from cursor for # or @
    var triggerPos = -1, triggerChar = '';
    for (var i = cursor - 1; i >= 0; i--) {
        if (val[i] === '#' || val[i] === '@') {
            // Check it's start of word (beginning or preceded by space)
            if (i === 0 || val[i-1] === ' ') {
                triggerPos = i;
                triggerChar = val[i];
                break;
            }
        }
        if (val[i] === ' ') break; // hit space, stop
    }
    if (triggerPos === -1) { hideAC(); return; }
    var query = val.substring(triggerPos + 1, cursor).toLowerCase();
    if (query.length === 0 && triggerChar === '@') { showACResults(triggerChar, query); return; }
    if (query.length === 0 && triggerChar === '#') { showACResults(triggerChar, query); return; }
    _acType = triggerChar === '#' ? 'hash' : 'at';
    _acQuery = query;
    _acStart = triggerPos;
    showACResults(triggerChar, query);
}

function showACResults(trigger, query) {
    var ac = document.getElementById('chatAutocomplete');
    if (!ac) return;
    var results = [];
    if (trigger === '#') {
        var targets = getHashTargets();
        for (var i = 0; i < targets.length; i++) {
            var t = targets[i];
            if (!query || t.tag.toLowerCase().includes(query) || t.label.toLowerCase().includes(query)) {
                results.push({value: t.tag, label: '#' + t.tag, desc: t.label});
            }
        }
    } else if (trigger === '@') {
        for (var uid in _chatUsers) {
            var name = _chatUsers[uid];
            if (!query || name.toLowerCase().includes(query)) {
                results.push({value: name, label: '@' + name, desc: ''});
            }
        }
    }
    if (results.length === 0) { hideAC(); return; }
    _acIndex = 0;
    var html = '';
    for (var j = 0; j < Math.min(results.length, 8); j++) {
        var r = results[j];
        html += '<div class="ac-item" data-value="' + esc(r.value) + '" data-trigger="' + trigger + '" onclick="selectAC(this)" style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:8px;transition:0.15s;' + (j === 0 ? 'background:rgba(99,102,241,0.1);' : '') + '" onmouseover="this.style.background=\'rgba(99,102,241,0.1)\'" onmouseout="if(' + j + '!==window._acIndex)this.style.background=\'none\'">';
        html += '<span style="font-weight:700;font-size:0.85rem;color:var(--accent);">' + esc(r.label) + '</span>';
        if (r.desc) html += '<span style="font-size:0.7rem;color:var(--text-faint);">' + esc(r.desc) + '</span>';
        html += '</div>';
    }
    ac.innerHTML = html;
    ac.style.display = 'block';
}

function highlightAC(items) {
    for (var i = 0; i < items.length; i++) {
        items[i].style.background = i === _acIndex ? 'rgba(99,102,241,0.1)' : 'none';
    }
}

window.selectAC = function(el) {
    if (!el) return;
    var value = el.getAttribute('data-value');
    var trigger = el.getAttribute('data-trigger');
    var input = document.getElementById('globalChatInput');
    if (!input) return;
    var val = input.value;
    var cursor = input.selectionStart;
    // Find the trigger position
    var triggerPos = _acStart;
    var before = val.substring(0, triggerPos);
    var after = val.substring(cursor);
    input.value = before + trigger + value + ' ' + after;
    var newCursor = before.length + trigger.length + value.length + 1;
    input.setSelectionRange(newCursor, newCursor);
    input.focus();
    hideAC();
    // Update char counter
    var counter = document.getElementById('globalChatCharCount');
    if (counter) counter.textContent = input.value.length;
};

function hideAC() {
    var ac = document.getElementById('chatAutocomplete');
    if (ac) ac.style.display = 'none';
    _acType = null;
    _acQuery = '';
}

// ---- Scroll to original message ----
window._scrollToChatMsg = function(msgId) {
    if (!msgId) return;
    // Try both possible container IDs
    var chatEl = document.getElementById('globalChatMessages') || document.getElementById('chatMessages');
    if (!chatEl) return;
    var target = chatEl.querySelector('[data-msg-id="' + msgId + '"]');
    if (target) {
        // Manually scroll the chat container so the message is centered
        var containerRect = chatEl.getBoundingClientRect();
        var targetRect = target.getBoundingClientRect();
        var targetOffsetTop = target.offsetTop;
        // Walk up to find offset relative to chatEl
        var el = target;
        var offset = 0;
        while (el && el !== chatEl) { offset += el.offsetTop; el = el.offsetParent; }
        var scrollTarget = offset - (chatEl.clientHeight / 2) + (target.clientHeight / 2);
        chatEl.scrollTo({ top: scrollTarget, behavior: 'smooth' });
        // Flash highlight on the message bubble
        var bubble = target.querySelector('[style*="border-radius"]') || target.querySelector('div') || target;
        var origBg = bubble.style.background || '';
        var origTransition = bubble.style.transition || '';
        bubble.style.transition = 'background 0.15s';
        bubble.style.background = 'rgba(99,102,241,0.35)';
        setTimeout(function() {
            bubble.style.background = 'rgba(99,102,241,0.15)';
            setTimeout(function() {
                bubble.style.background = origBg;
                bubble.style.transition = origTransition;
            }, 400);
        }, 500);
    } else {
        // Message not in DOM — likely scrolled out of loaded range
        if (typeof showToast === 'function') showToast('↑ Scroll up to find the original message', 2500);
    }
};

// ---- Reply Handling ----
window.setChatReply = function(msgId, name, preview) {
    _replyTo = {_id: msgId, name: name, text: preview};
    var banner = document.getElementById('chatReplyBanner');
    var nameEl = document.getElementById('chatReplyName');
    var previewEl = document.getElementById('chatReplyPreview');
    if (banner && nameEl && previewEl) {
        nameEl.textContent = name;
        previewEl.textContent = preview.length > 50 ? preview.substring(0, 50) + '…' : preview;
        banner.style.display = 'block';
    }
    var input = document.getElementById('globalChatInput');
    if (input) input.focus();
};

window.cancelReply = function() {
    _replyTo = null;
    var banner = document.getElementById('chatReplyBanner');
    if (banner) banner.style.display = 'none';
};

// ---- Paste Image Handling ----
function handlePaste(e) {
    var items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (var i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            var file = items[i].getAsFile();
            if (file) {
                if (file.size > 10 * 1024 * 1024) {
                    if (typeof showToast === 'function') showToast('Pasted image too large (max 10MB)');
                    continue;
                }
                if (file.type === 'image/gif') {
                    readAndPreview(file);
                } else {
                    compressAndPreview(file);
                }
                // Preemptively prevent text paste if an image was handled
                // (though usually you want both if both are present)
            }
        }
    }
}

// ---- Send Message ----
window.sendGlobalChat = function() {
    // Dismiss pickers on send
    var _ep = document.getElementById('gcEmojiPicker'); if (_ep) _ep.remove();
    var _gp = document.getElementById('gifPicker'); if (_gp) _gp.remove();
    // Check for pending image/GIF — send it (with optional caption text)
    if (window._chatPendingImage) {
        var imgData = window._chatPendingImage;
        var imgBlob = window._chatPendingImageBlob;
        var imgType = window._chatPendingImageType;
        var isGif = window._chatPendingIsGif;
        var captionInput = document.getElementById('globalChatInput');
        var caption = captionInput ? captionInput.value.trim() : '';
        window._chatPendingImage = null;
        window._chatPendingImageBlob = null;
        window._chatPendingImageType = null;
        window._chatPendingIsGif = false;
        if (captionInput) captionInput.value = '';
        var counter = document.getElementById('globalChatCharCount');
        if (counter) counter.textContent = '0';
        document.querySelectorAll('#chatImagePreview').forEach(function(el) { el.remove(); });
        if (isGif) { sendGifMessage(imgData, caption); } else { sendImageMessage(imgData, caption, imgBlob, imgType); }
        return;
    }

    var input = document.getElementById('globalChatInput');
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;

    // Validation
    if (text.length > MAX_MSG_LENGTH) {
        if (typeof showToast === 'function') showToast('Message too long (max ' + MAX_MSG_LENGTH + ' chars)');
        return;
    }

    // Rate limit
    var now = Date.now();
    if (now - _lastSendTime < RATE_LIMIT_MS) {
        if (typeof showToast === 'function') showToast('Slow down! Wait a moment before sending again.');
        return;
    }

    // Admin bypass — admins skip all content restrictions
    var _chatAdminEmails = ['needcreations@gmail.com', 'info.603btc@gmail.com'];
    var _isChatAdmin = typeof auth !== 'undefined' && auth.currentUser && auth.currentUser.email && _chatAdminEmails.indexOf(auth.currentUser.email) !== -1;

    if (!_isChatAdmin) {
        // Profanity check
        if (containsProfanity(text)) {
            if (typeof showToast === 'function') showToast('🚫 Message contains inappropriate language.');
            return;
        }

        // Link filter — strip all URLs from chat messages
        if (/https?:\/\/\S+|www\.\S+|\S+\.(com|org|net|io|co|xyz|me|info|dev|app)\b/i.test(text)) {
            text = text.replace(/https?:\/\/\S+/gi, '[link removed]').replace(/www\.\S+/gi, '[link removed]').replace(/\S+\.(com|org|net|io|co|xyz|me|info|dev|app)\S*/gi, '[link removed]');
            if (typeof showToast === 'function') showToast('🔗 Links are not allowed in chat.', 4000);
            if (text.replace(/\[link removed\]/g, '').trim().length === 0) return;
        }

        // Spam check
        if (isSpammy(text)) {
            if (typeof showToast === 'function') showToast('🚫 Message flagged as spam. Please write normally.');
            return;
        }

        // PII check — block phone numbers and email addresses in public chat
        if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(text) || /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(text)) {
            if (typeof showToast === 'function') showToast('🔒 For your safety, phone numbers and email addresses are not allowed in public chat. Use DMs instead.', 6000);
            return;
        }
    }

    // Auth check
    if (typeof auth === 'undefined' || !auth || !auth.currentUser) {
        if (typeof showToast === 'function') showToast('Sign in to chat!');
        return;
    }

    var user = auth.currentUser;
    var username = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'Anon';

    if (!username || username === 'Anon') {
        if (typeof showToast === 'function') showToast('Set a username first in Settings!');
        return;
    }

    // Check if user is muted (admin can mute via Firestore)
    var uid = user.uid;

    _lastSendTime = now;
    input.value = '';
    var counter = document.getElementById('globalChatCharCount');
    if (counter) counter.textContent = '0';

    // Notify @mentioned users
    var mentionRegex = /@([a-zA-Z0-9_]+)/g;
    var mention;
    while ((mention = mentionRegex.exec(text)) !== null) {
        var mentionedName = mention[1];
        // Find uid from cached users
        for (var muid in _chatUsers) {
            if (_chatUsers[muid] === mentionedName && typeof notifyChatMention === 'function') {
                notifyChatMention(muid, username, text.substring(0, 60));
                break;
            }
        }
    }

    // Clear reply banner
    var replyData = {};
    if (_replyTo) {
        replyData = {replyTo: _replyTo._id, replyToName: _replyTo.name, replyToText: _replyTo.text};
        _replyTo = null;
        var banner = document.getElementById('chatReplyBanner');
        if (banner) banner.style.display = 'none';
    }

    // Write to Firestore
    // isNachoAuto: false ensures this message is included when the chat listener
    // filters with .where('isNachoAuto', '==', false) to exclude Nacho announcements.
    var msgData = {uid: uid, name: username, text: text, isNachoAuto: false, ts: firebase.firestore.FieldValue.serverTimestamp()};
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.faction) msgData.faction = currentUser.faction;
    if (replyData.replyTo) { msgData.replyTo = replyData.replyTo; msgData.replyToName = replyData.replyToName; msgData.replyToText = replyData.replyToText; }
    db.collection(CHAT_COLLECTION).add(msgData).then(function(docRef) {
        // Track for daily challenge
        try { var _t = new Date().toISOString().split('T')[0]; localStorage.setItem('btc_chat_sent_' + _t, 'true'); } catch(e) {}
        // Increment global chat counter
        db.collection('stats').doc('global').set({ chatMessages: firebase.firestore.FieldValue.increment(1) }, { merge: true }).catch(function() {});
        // Raid Boss: chat message
        if (typeof window._raidOnChatMessage === 'function') window._raidOnChatMessage();
        // Bridge to Telegram with messageId for reaction sync
        if (docRef && docRef.id) {
            bridgeToTelegram({ user: username, text: text, replyToName: replyData.replyToName || '', replyToText: replyData.replyToText || '', messageId: docRef.id });
        }
    }).catch(function(err) {
        console.error('[CHAT] Send error:', err);
        if (typeof showToast === 'function') showToast('Failed to send: ' + (err.message || 'Unknown error'));
    });

    // Track total messages sent
    var totalMsgs = parseInt(localStorage.getItem('btc_chat_msgs') || '0') + 1;
    localStorage.setItem('btc_chat_msgs', totalMsgs);

    // Award points for first chat message of the day + streak tracking
    var today = new Date().toISOString().split('T')[0];
    var chatDay = 'btc_chat_day_' + new Date().toDateString();
    if (!localStorage.getItem(chatDay)) {
        localStorage.setItem(chatDay, '1');
        if (typeof awardPoints === 'function') awardPoints(5, '💬 Global Chat');
        if (typeof awardTickets === 'function') awardTickets(2, '💬 Daily chat');

        // Update chat streak
        var lastChatDate = localStorage.getItem('btc_chat_last_date') || '';
        var streak = parseInt(localStorage.getItem('btc_chat_streak') || '0');
        if (lastChatDate) {
            var lastD = new Date(lastChatDate);
            var todayD = new Date(today);
            var diff = Math.round((todayD - lastD) / 86400000);
            if (diff === 1) {
                streak++;
            } else if (diff > 1) {
                streak = 1;
            }
        } else {
            streak = 1;
        }
        localStorage.setItem('btc_chat_streak', streak);
        localStorage.setItem('btc_chat_last_date', today);

        // Bonus points for streaks
        if (streak === 3 && typeof awardPoints === 'function') awardPoints(10, '🔥 3-day chat streak!');
        if (streak === 7 && typeof awardPoints === 'function') awardPoints(25, '🔥 7-day chat streak!');
        if (streak === 30 && typeof awardPoints === 'function') awardPoints(100, '💎 30-day chat streak!');
    }

    // Milestone rewards for total messages
    if (totalMsgs === 10 && typeof awardPoints === 'function') awardPoints(10, '💬 10 messages sent!');
    if (totalMsgs === 50 && typeof awardPoints === 'function') awardPoints(15, '💬 50 messages sent!');
    if (totalMsgs === 100 && typeof awardPoints === 'function') awardPoints(25, '📢 100 messages sent!');
    if (totalMsgs === 500 && typeof awardPoints === 'function') awardPoints(50, '👑 500 messages sent!');

    // Nacho auto-answer: only fire on questions that are relevant to Bitcoin/the site
    // Pure social chit-chat ("how's your weekend?") must be ignored — Nacho only speaks when useful
    var _nachoShouldAnswer = (function(t) {
        if (!t.includes('?')) return false;
        var lower = t.toLowerCase();
        // Block pure social/greetings — Nacho stays quiet for these in group chat
        var socialOnly = /^(how'?s|how is|how was|what'?s|hows)\s+(your|everyone'?s|the|ur)\s+(weekend|day|week|night|morning|evening|life|family|summer|holiday|trip|vacation|monday|tuesday|wednesday|thursday|friday|saturday|sunday)[.!?,\s]*$/i;
        if (socialOnly.test(t.trim())) return false;
        var pureGreetings = /^(how are you|how r u|how do you do|how you doing|how ya doing|how's it going|what'?s up|wassup|whats up|you good|you okay|how have you been|how'?s everyone doing|how'?s everybody)[.!?,\s]*$/i;
        if (pureGreetings.test(t.trim())) return false;
        // Must have at least one Bitcoin-relevant keyword to trigger Nacho
        var btcKeywords = /bitcoin|btc|satoshi|sats|lightning|lightning network|lnurl|wallet|seed|private key|public key|mining|miner|hash|blockchain|block|halving|node|mempool|utxo|segwit|taproot|schnorr|ordinals|inscription|nostr|defi|altcoin|ethereum|eth|crypto|hodl|dca|cold storage|hardware wallet|ledger|trezor|coldcard|nwc|invoice|channel|payment|fee|transaction|tx|address|receive|send|self.?custody|inflation|fiat|money|currency|dollar|euro|store of value|gold|silver|bank|finance|invest|etf|yield|price|market|exchange|coinbase|binance|kraken|bitfinex|layer 2|l2|lnbc|bolt|rgb|ark |dlc|coinjoin|whirlpool|wasabi|sparrow|phoenix|breez|bluewallet|umbrel|mynode|raspiblitz|electrum|green|muun|strike|cash app|alby|zeus|blink|fountain|podcast|bitcoin magazine|nakamoto|genesis block|white ?paper|proof of work|pow|consensus|decentraliz|censor|privacy|sovereign|freedom|shield|archive|quest|quiz|nacho|channel|article|forum|plebtalk|marketplace|leaderboard|badge|points|sats|ticket|spin|scholar|scholar cert|pvp|beats|irl|global chat|settings|profile|theme|sign in|log in|sign up|register|account/i;
        return btcKeywords.test(lower);
    })(text);
    if (_nachoShouldAnswer && typeof nachoUnifiedAnswer === 'function') {
        nachoUnifiedAnswer(text, function(result) {
            if (!result || !result.answer) return;
            // Skip web search and deep search answers (contain HTML, not suitable for chat)
            // Note: allow 'fallback' answers through — better to give a deflection than silence
            if (result.type === 'websearch' || result.type === 'deepsearch') return;
            var answer = result.answer.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim();
            if (!answer || answer.length < 10) return;
            // Append channel link if Nacho's answer references a channel
            if (result.channel && typeof CHANNELS !== 'undefined' && CHANNELS[result.channel]) {
                answer += ' 👉 #' + result.channel;
            }
            // Add links for common app/navigation references
            var lowerAnswer = answer.toLowerCase();
            if (!result.channel) {
                if (/\bhome\b/.test(lowerAnswer) && !/#/.test(answer)) answer += ' 👉 Go to Home by tapping the ₿ logo!';
                else if (/\bnacho mode\b/.test(lowerAnswer) && !/#nacho/.test(answer)) answer += ' 👉 #nacho';
                else if (/\bbeats\b|\bmusic\b|\bdj\b/.test(lowerAnswer) && !/#bitcoin-beats/.test(answer)) answer += ' 👉 #bitcoin-beats';
                else if (/\bforum\b|\bpleb\s*talk\b/.test(lowerAnswer) && !/#forum/.test(answer)) answer += ' 👉 #forum';
                else if (/\bmarketplace\b|\blightning\s*mart\b/.test(lowerAnswer) && !/#marketplace/.test(answer)) answer += ' 👉 #marketplace';
                else if (/\bmeetup\b|\birl\b|\bevent\b/.test(lowerAnswer) && !/#irl-sync/.test(answer)) answer += ' 👉 #irl-sync';
                else if (/\bleaderboard\b|\branking\b/.test(lowerAnswer)) answer += ' 👉 Check the 🏆 Leaderboard!';
                else if (/\bsettings\b|\bprofile\b|\baccount\b/.test(lowerAnswer)) answer += ' 👉 Tap ⚙️ Settings!';
            }
            // Nacho gets a longer limit than users (1000 vs 300)
            if (answer.length > 1000) answer = answer.substring(0, 997) + '...';
            setTimeout(function() {
                // Check if current user is admin (can use nacho-bot uid)
                var _nachoUid = 'nacho-bot';
                var _nachoName = '🦌 Nacho';
                var _isAdmin = auth && auth.currentUser && auth.currentUser.email &&
                    (auth.currentUser.email === 'needcreations@gmail.com' || auth.currentUser.email === 'info.603btc@gmail.com');
                if (!_isAdmin) {
                    // Non-admin: write as the user's uid with nacho flag (Firestore rules allow uid == auth.uid)
                    _nachoUid = auth && auth.currentUser ? auth.currentUser.uid : 'nacho-bot';
                    _nachoName = '🦌 Nacho';
                }
                db.collection(CHAT_COLLECTION).add({
                    uid: _nachoUid,
                    name: _nachoName,
                    text: answer,
                    isNachoAuto: true,
                    ts: firebase.firestore.FieldValue.serverTimestamp()
                }).then(function() {
                    console.log('[BRIDGE] Sending Nacho answer to Telegram, length:', answer.length);
                    bridgeToTelegram({ user: '🦌 Nacho', text: answer });
                }).catch(function(e) { console.error('[CHAT] Nacho reply failed:', e); });
            }, 2000 + Math.random() * 2000);
        });
    }
};

// Admin: delete a chat message
window.deleteChatMsg = function(msgId) {
    if (!confirm('Delete this message?')) return;
    db.collection(CHAT_COLLECTION).doc(msgId).delete().then(function() {
        if (typeof showToast === 'function') showToast('🗑️ Message deleted');
    }).catch(function() {
        if (typeof showToast === 'function') showToast('Failed to delete');
    });
};

// ---- Announcements Tab — Nacho news feed ----
function renderAnnouncementsTab() {
    var content = document.getElementById('chatContent');
    if (!content) return;

    content.innerHTML =
        '<div id="announcementsMessages" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 14px;display:flex;flex-direction:column;gap:10px;min-height:0;">' +
            '<div style="text-align:center;padding:20px;color:var(--text-faint);font-size:0.75rem;">Loading announcements...</div>' +
        '</div>';

    if (typeof db === 'undefined' || !db) {
        document.getElementById('announcementsMessages').innerHTML =
            '<div style="text-align:center;padding:30px;color:var(--text-faint);font-size:0.8rem;">Not connected</div>';
        return;
    }

    // Load from the announcements collection (asc = oldest first, newest at bottom)
    db.collection(ANNOUNCEMENTS_COLLECTION)
        .orderBy('ts', 'asc')
        .limit(50)
        .get()
        .then(function(snapshot) {
            var el = document.getElementById('announcementsMessages');
            if (!el) return;
            if (snapshot.empty) {
                el.innerHTML = '<div style="text-align:center;padding:40px 20px;">' +
                    '<div style="font-size:2.5rem;margin-bottom:12px;">🦌</div>' +
                    '<div style="color:var(--text-muted);font-size:0.85rem;font-weight:600;">No announcements yet</div>' +
                    '<div style="color:var(--text-faint);font-size:0.75rem;margin-top:6px;">Nacho posts updates here — badge unlocks, perfect scores, PVP alerts &amp; more</div>' +
                '</div>';
                return;
            }
            var html = '<div style="text-align:center;padding:8px 0 16px;">' +
                '<div style="font-size:0.7rem;color:var(--text-faint);">Nacho\'s updates · badges, scores, events &amp; more</div>' +
            '</div>';
            snapshot.forEach(function(doc) {
                html += _renderAnnouncementItem(doc, 'panel');
            });
            el.innerHTML = html;
            // Scroll to bottom so newest announcement is visible
            setTimeout(function() { el.scrollTop = el.scrollHeight; }, 50);
        })
        .catch(function(err) {
            console.error('[ANNOUNCEMENTS] Load error:', err);
            var el = document.getElementById('announcementsMessages');
            if (el) el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-faint);font-size:0.8rem;">Could not load announcements</div>';
        });
}

// ---- DMs Tab (wraps existing showInbox) ----
function renderDMsTab() {
    var content = document.getElementById('chatContent');
    if (!content) return;

    // Create a container for the existing DM system
    content.innerHTML = '<div id="dmTabContainer" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;"></div>';

    // Use existing inbox renderer if available
    if (typeof window._renderInboxInto === 'function') {
        window._renderInboxInto(document.getElementById('dmTabContainer'));
    } else if (typeof showInbox === 'function') {
        // Fallback: render the existing inbox into forumContainer, then move it
        var fc = document.getElementById('forumContainer');
        var savedHtml = fc.innerHTML;
        showInbox();
        var inboxContent = fc.innerHTML;
        fc.innerHTML = savedHtml;
        // Re-render the chat hub with DM content injected
        var dmContainer = document.getElementById('dmTabContainer');
        if (dmContainer) dmContainer.innerHTML = inboxContent;
    } else {
        content.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:0.85rem;">DMs not available yet. Sign in to enable messaging.</div>';
    }
}

// ---- Override showInbox to route through chat hub ----
var _origShowInbox = window.showInbox;
window.showInbox = function() {
    renderChatHub('dms');
};
// Keep original accessible
window._showInboxOriginal = _origShowInbox;

// ---- Cleanup on navigation ----
var _origGoHome = window.goHome;
if (_origGoHome) {
    window.goHome = function() {
        if (_chatUnsub) { _chatUnsub(); _chatUnsub = null; }
        return _origGoHome.apply(this, arguments);
    };
}

// ---- Hash route ----
// #chat opens global chat, #dms opens DMs tab
var _origGo = window.go;
if (_origGo) {
    window.go = function(id) {
        if (id === 'chat') {
            renderChatHub('global');
            return;
        }
        if (_chatUnsub) { _chatUnsub(); _chatUnsub = null; }
        return _origGo.apply(this, arguments);
    };
}

// ---- Overlay Chat Mode ----
// Floating button + slide-up panel so chat works on top of any page
var _overlayOpen = false;

function createChatOverlay() {
    if (document.getElementById('chatOverlay')) return;

    // chatOverlayBtn is static HTML — just wire onclick
    var btn = document.getElementById('chatOverlayBtn');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'chatOverlayBtn';
        btn.className = 'fab-btn';
        btn.innerHTML = '💬';
        document.body.appendChild(btn);
    }
    btn.onclick = toggleChatOverlay;
    btn.title = 'Open Chat';

    // Overlay panel
    var panel = document.createElement('div');
    panel.id = 'chatOverlay';
    var _isMobChat = window.innerWidth <= 900;
    panel.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:250000;height:' + (_isMobChat ? '92vh' : '80vh') + ';max-height:' + (_isMobChat ? '100vh' : '700px') + ';background:var(--bg,#0a0a0f);border-top:2px solid var(--accent,#f7931a);border-radius:16px 16px 0 0;transform:translateY(100%);transition:transform 0.3s cubic-bezier(0.22,1,0.36,1);display:flex;flex-direction:column;box-shadow:0 -8px 32px rgba(0,0,0,0.5);';

    // Combined header: Satoshi's Favor + Minimize on one line
    var header = document.createElement('div');
    header.style.cssText = 'flex-shrink:0;padding:6px 12px;border-bottom:1px solid var(--border);';
    // Drag handle
    header.innerHTML = '<div style="width:40px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 6px;"></div>';
    // Satoshi's Favor banner + minimize button on same line
    header.innerHTML += '<div style="display:flex;width:100%;align-items:center;justify-content:space-between;gap:8px;">' +
        '<div id="satoshiFavorChatBanner" style="flex:1;min-width:0;"></div>' +
        '<button onclick="toggleChatOverlay()" style="flex-shrink:0;padding:4px 10px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:0.7rem;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;">▼ Minimize</button>' +
    '</div>';

    // Chat content container
    var body = document.createElement('div');
    body.id = 'chatOverlayBody';
    body.style.cssText = 'flex:1;overflow:hidden;display:flex;flex-direction:column;min-height:0;';

    panel.appendChild(header);
    panel.appendChild(body);
    document.body.appendChild(panel);

    // Unread badge on the button
    var badge = document.createElement('span');
    badge.id = 'chatOverlayBadge';
    badge.style.cssText = 'display:none;position:absolute;top:-2px;right:-2px;background:#ef4444;color:#fff;font-size:0.6rem;font-weight:800;padding:2px 5px;border-radius:8px;min-width:14px;text-align:center;';
    btn.style.position = 'fixed'; // ensure btn is positioned
    btn.appendChild(badge);

    // Chat panel desktop sizing
    var style = document.createElement('style');
    style.textContent = '@media(min-width:901px){#chatOverlay{max-width:400px;right:16px;left:auto;border-radius:16px 16px 0 0;}}@keyframes djPulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)}50%{box-shadow:0 0 0 6px rgba(239,68,68,0)}}';
    document.head.appendChild(style);
}

window.toggleChatOverlay = function() {
    var panel = document.getElementById('chatOverlay');
    var btn = document.getElementById('chatOverlayBtn');
    if (!panel) return;

    _overlayOpen = !_overlayOpen;
    window._chatOverlayOpen = _overlayOpen;
    panel.style.transform = _overlayOpen ? 'translateY(0)' : 'translateY(100%)';
    // Shift leaderboard button up when chat is open so it doesn't cover input buttons
    var _lbFab = document.getElementById('lbFloatBtn');
    if (_lbFab) { if (_overlayOpen) _lbFab.classList.add('chat-shifted'); else _lbFab.classList.remove('chat-shifted'); }
    if (_overlayOpen) {
        localStorage.setItem('hasUsedChat', '1');
        // Always open to Global Chat tab
        _overlayTab = 'global';
        // Render Satoshi's Favor banner
        if (typeof window._renderFavorChatBanner === 'function') window._renderFavorChatBanner();
        if (!_bgChatUnsub && typeof db !== 'undefined' && db) startUnreadTracker();
        history.pushState({ modal: 'chat' }, '', window.location.pathname + window.location.hash);
    }

    if (btn) {
        btn.innerHTML = '💬';
        btn.style.background = 'var(--accent,#f7931a)';
        btn.style.color = '#fff';
        btn.style.display = _overlayOpen ? 'none' : 'block';
    }

    // Click-outside backdrop
    var backdrop = document.getElementById('chatOverlayBackdrop');
    if (_overlayOpen) {
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.id = 'chatOverlayBackdrop';
            backdrop.style.cssText = 'position:fixed;inset:0;z-index:298;background:transparent;';
            backdrop.onclick = function() { toggleChatOverlay(); };
            document.body.appendChild(backdrop);
        }
    } else {
        if (backdrop) backdrop.remove();
    }

    // Clear badge
    var badge = document.getElementById('chatOverlayBadge');
    if (badge) badge.style.display = 'none';

    if (_overlayOpen) {
        renderOverlayChat();
    } else {
        // Unsubscribe when closing
        if (_chatUnsub) { _chatUnsub(); _chatUnsub = null; }
    }
};

var _overlayTab = 'global';

function renderOverlayChat() {
    var body = document.getElementById('chatOverlayBody');
    if (!body) return;

    _overlayTab = _overlayTab || 'global';

    var isSignedIn = typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous;
    var hasUsername = typeof currentUser !== 'undefined' && currentUser && currentUser.username;

    // Tab bar — compact so all 4 fit in the overlay
    var _oA = function(t) { return t === _overlayTab ? 'var(--accent)' : 'var(--text-muted)'; };
    var _oB = function(t) { return t === _overlayTab ? 'var(--accent)' : 'transparent'; };
    var tabHtml = '<div style="display:flex;border-bottom:1px solid var(--border);flex-shrink:0;">' +
        '<button onclick="window._switchOverlayTab(\'global\')" style="flex:1;padding:10px 0;background:none;border:none;border-bottom:2px solid ' + _oB('global') + ';color:' + _oA('global') + ';font-size:0.72rem;font-weight:700;cursor:pointer;font-family:inherit;">🌍 Global</button>' +
        '<button onclick="window._switchOverlayTab(\'announcements\')" style="flex:1;padding:10px 0;background:none;border:none;border-bottom:2px solid ' + _oB('announcements') + ';color:' + _oA('announcements') + ';font-size:0.72rem;font-weight:700;cursor:pointer;font-family:inherit;">📣 News</button>' +
        '<button onclick="window._switchOverlayTab(\'dms\')" style="flex:1;padding:10px 0;background:none;border:none;border-bottom:2px solid ' + _oB('dms') + ';color:' + _oA('dms') + ';font-size:0.72rem;font-weight:700;cursor:pointer;font-family:inherit;">✉️ DMs</button>' +
        '<button onclick="if(typeof showChatRules===\'function\')showChatRules()" style="padding:10px 7px;background:none;border:none;border-bottom:2px solid transparent;color:var(--text-faint);font-size:0.65rem;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;">📋 Rules</button>' +
    '</div>';

    if (_overlayTab === 'announcements') {
        body.innerHTML = tabHtml +
            '<div id="overlayAnnouncementsBody" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:10px 12px;display:flex;flex-direction:column;gap:8px;min-height:0;">' +
                '<div style="text-align:center;padding:20px;color:var(--text-faint);font-size:0.75rem;">Loading...</div>' +
            '</div>';
        // Load announcements into overlay
        if (typeof db !== 'undefined' && db) {
            db.collection(ANNOUNCEMENTS_COLLECTION)
                .orderBy('ts', 'asc')
                .limit(40)
                .get()
                .then(function(snapshot) {
                    var el = document.getElementById('overlayAnnouncementsBody');
                    if (!el) return;
                    if (snapshot.empty) {
                        el.innerHTML = '<div style="text-align:center;padding:30px 16px;"><div style="font-size:2rem;margin-bottom:8px;">🦌</div><div style="color:var(--text-muted);font-size:0.8rem;">No announcements yet</div></div>';
                        return;
                    }
                    var html = '';
                    snapshot.forEach(function(doc) {
                        html += _renderAnnouncementItem(doc, 'overlay');
                    });
                    el.innerHTML = html;
                    // Scroll to bottom so newest announcement is visible
                    setTimeout(function() { el.scrollTop = el.scrollHeight; }, 50);
                })
                .catch(function() {
                    var el = document.getElementById('overlayAnnouncementsBody');
                    if (el) el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-faint);font-size:0.8rem;">Could not load</div>';
                });
        }
        return;
    }

    if (_overlayTab === 'dms') {
        body.innerHTML = tabHtml +
            '<div id="overlayDMsBody" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:8px;min-height:0;">' +
                '<div style="text-align:center;padding:20px;color:var(--text-faint);font-size:0.8rem;">Loading DMs...</div>' +
            '</div>';
        setTimeout(function() {
            var dmBody = document.getElementById('overlayDMsBody');
            if (!dmBody) return;
            if (!isSignedIn) {
                dmBody.innerHTML = '<div style="text-align:center;padding:30px;"><div style="font-size:1.5rem;margin-bottom:8px;">📬</div><div style="color:var(--text-faint);font-size:0.85rem;">Sign in to see messages</div></div>';
                return;
            }
            var myUid = auth.currentUser.uid;
            db.collection('dm_conversations')
                .where('participants', 'array-contains', myUid)
                .orderBy('lastMessageTime', 'desc')
                .limit(30)
                .get()
                .then(function(snap) {
                    if (!document.getElementById('overlayDMsBody')) return;
                    if (snap.empty) {
                        dmBody.innerHTML = '<div style="text-align:center;padding:30px;"><div style="font-size:1.5rem;margin-bottom:8px;">📬</div><div style="color:var(--text-muted);font-size:0.85rem;">No messages yet</div><div style="color:var(--text-faint);font-size:0.75rem;margin-top:4px;">Tap a user on the leaderboard to start chatting!</div></div>';
                        return;
                    }
                    var html = '';
                    snap.forEach(function(doc) {
                        var c = doc.data();
                        var otherUid = c.participants.find(function(p) { return p !== myUid; });
                        var otherName = c.participantNames ? (c.participantNames[otherUid] || 'User') : 'User';
                        var unread = c['unread_' + myUid] || 0;
                        var lastMsg = c.lastMessage || '';
                        if (lastMsg.length > 40) lastMsg = lastMsg.substring(0, 40) + '...';
                        var lastTime = c.lastMessageTime ? timeAgo(c.lastMessageTime) : '';
                        var isFromMe = c.lastSenderUid === myUid;
                        html += '<div onclick="toggleChatOverlay();setTimeout(function(){openDM(\'' + otherUid + '\',\'' + (typeof escapeHtml === 'function' ? escapeHtml(otherName) : otherName).replace(/[\\'"]/g, "") + '\')},300)" style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;cursor:pointer;transition:0.2s;border:1px solid ' + (unread > 0 ? 'rgba(249,115,22,0.3)' : 'transparent') + ';background:' + (unread > 0 ? 'rgba(249,115,22,0.05)' : 'none') + ';margin-bottom:4px;">' +
                            '<div style="width:36px;height:36px;border-radius:50%;background:var(--card-bg);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;color:var(--text);">' + (otherName.charAt(0).toUpperCase() || '?') + '</div>' +
                            '<div style="flex:1;min-width:0;">' +
                                '<div style="display:flex;justify-content:space-between;align-items:center;">' +
                                    '<div style="font-weight:' + (unread > 0 ? '700' : '500') + ';color:var(--heading);font-size:0.82rem;">' + (typeof escapeHtml === 'function' ? escapeHtml(otherName) : otherName) + '</div>' +
                                    '<div style="font-size:0.6rem;color:var(--text-faint);flex-shrink:0;">' + lastTime + '</div>' +
                                '</div>' +
                                '<div style="font-size:0.75rem;color:' + (unread > 0 ? 'var(--text)' : 'var(--text-muted)') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (isFromMe ? 'You: ' : '') + (typeof escapeHtml === 'function' ? escapeHtml(lastMsg) : lastMsg) + '</div>' +
                            '</div>' +
                            (unread > 0 ? '<div style="background:var(--accent);color:#fff;font-size:0.6rem;font-weight:800;padding:2px 6px;border-radius:8px;flex-shrink:0;">' + unread + '</div>' : '') +
                        '</div>';
                    });
                    dmBody.innerHTML = html;
                })
                .catch(function(err) {
                    console.error('Overlay DM load error:', err);
                    if (err.code === 'failed-precondition') {
                        // Retry without orderBy
                        db.collection('dm_conversations').where('participants', 'array-contains', myUid).limit(30).get().then(function(snap) {
                            if (!document.getElementById('overlayDMsBody')) return;
                            if (snap.empty) { dmBody.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-faint);">No messages yet</div>'; return; }
                            var html = '';
                            snap.forEach(function(doc) {
                                var c = doc.data();
                                var otherUid = c.participants.find(function(p) { return p !== myUid; });
                                var otherName = c.participantNames ? (c.participantNames[otherUid] || 'User') : 'User';
                                var unread = c['unread_' + myUid] || 0;
                                html += '<div onclick="toggleChatOverlay();setTimeout(function(){openDM(\'' + otherUid + '\',\'' + (typeof escapeHtml === 'function' ? escapeHtml(otherName) : otherName).replace(/[\\'"]/g, "") + '\')},300)" style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;cursor:pointer;border:1px solid transparent;margin-bottom:4px;">' +
                                    '<div style="width:36px;height:36px;border-radius:50%;background:var(--card-bg);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;color:var(--text);">' + (otherName.charAt(0).toUpperCase() || '?') + '</div>' +
                                    '<div style="flex:1;min-width:0;"><div style="font-weight:600;color:var(--heading);font-size:0.82rem;">' + (typeof escapeHtml === 'function' ? escapeHtml(otherName) : otherName) + '</div></div>' +
                                    (unread > 0 ? '<div style="background:var(--accent);color:#fff;font-size:0.6rem;font-weight:800;padding:2px 6px;border-radius:8px;">' + unread + '</div>' : '') +
                                '</div>';
                            });
                            dmBody.innerHTML = html;
                        }).catch(function() { dmBody.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-faint);">Could not load messages</div>'; });
                    } else {
                        dmBody.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-faint);">Could not load messages</div>';
                    }
                });
        }, 100);
        return;
    }

    body.innerHTML = tabHtml +
        '<div id="globalChatMessages" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:10px 14px;display:flex;flex-direction:column;gap:6px;min-height:0;">' +
            '<div style="text-align:center;padding:20px;color:var(--text-faint);font-size:0.75rem;">Loading chat...</div>' +
        '</div>' +
        '<div style="flex-shrink:0;padding:8px 14px;border-top:1px solid var(--border);background:var(--bg-side);">' +
            (hasUsername ?
                '<div id="chatReplyBanner" style="display:none;padding:4px 10px;background:rgba(99,102,241,0.1);border-left:3px solid #6366f1;border-radius:6px;margin-bottom:4px;font-size:0.7rem;color:var(--text-muted);position:relative;">Replying to <strong id="chatReplyName"></strong>: <span id="chatReplyPreview"></span><span onclick="cancelReply()" style="position:absolute;right:6px;top:2px;cursor:pointer;font-size:0.85rem;color:var(--text-faint);">✕</span></div>' +
                '<div style="position:relative;">' +
                    '<div id="chatAutocomplete" style="display:none;position:absolute;bottom:100%;left:0;right:0;max-height:150px;overflow-y:auto;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;margin-bottom:4px;box-shadow:0 -4px 16px rgba(0,0,0,0.3);z-index:10;"></div>' +
                    '<div style="display:flex;gap:4px;align-items:center;">' +
                        '<button onclick="sendGlobalChat()" style="padding:8px 12px;background:var(--accent);color:#fff;border:none;border-radius:20px;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;flex-shrink:0;touch-action:manipulation;">Send</button>' +
                        '<input type="text" id="globalChatInput" placeholder="Say something..." maxlength="' + MAX_MSG_LENGTH + '" style="flex:1;min-width:0;padding:10px 14px;background:var(--input-bg);border:1px solid var(--border);border-radius:20px;color:var(--text);font-size:16px;font-family:inherit;outline:none;box-sizing:border-box;" autocomplete="off">' +
                        '<button onclick="showEmojiPicker()" style="padding:6px;background:none;border:none;font-size:1rem;cursor:pointer;flex-shrink:0;color:var(--text-faint);touch-action:manipulation;" title="Emoji">😀</button>' +
                        '<button onclick="chatUploadImage()" style="padding:6px;background:none;border:none;font-size:1rem;cursor:pointer;flex-shrink:0;color:var(--text-faint);touch-action:manipulation;" title="Upload Image">📷</button>' +
                        '<button onclick="showGifPicker()" style="padding:6px;background:none;border:none;font-size:0.7rem;font-weight:700;cursor:pointer;flex-shrink:0;color:var(--text-faint);touch-action:manipulation;" title="Send GIF">GIF</button>' +
                    '</div>' +
                '</div>'
            :
                '<div onclick="' + (isSignedIn ? 'if(typeof showSettingsPage===\'function\')showSettingsPage(\'account\')' : 'if(typeof showUsernamePrompt===\'function\')showUsernamePrompt()') + '" style="text-align:center;padding:10px;color:var(--accent);font-size:0.8rem;font-weight:700;cursor:pointer;">' +
                    (isSignedIn ? '⚙️ Set a username in Settings to chat' : '🔐 Sign in to chat') +
                '</div>'
            ) +
        '</div>';

    // Wire up input handlers
    var input = document.getElementById('globalChatInput');
    if (input) {
        input.addEventListener('paste', handlePaste);
        input.addEventListener('input', function() {
            handleAutocomplete(this);
        });
        input.addEventListener('keydown', function(e) {
            var ac = document.getElementById('chatAutocomplete');
            if (ac && ac.style.display !== 'none') {
                var items = ac.querySelectorAll('.ac-item');
                if (e.key === 'ArrowDown') { e.preventDefault(); _acIndex = Math.min(_acIndex + 1, items.length - 1); highlightAC(items); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); _acIndex = Math.max(_acIndex - 1, 0); highlightAC(items); }
                else if (e.key === 'Enter' || e.key === 'Tab') {
                    if (items.length > 0) { e.preventDefault(); selectAC(items[_acIndex]); return; }
                }
                else if (e.key === 'Escape') { hideAC(); return; }
            }
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendGlobalChat(); }
        });
    }

    startChatListener();
}

window._switchOverlayTab = function(tab) {
    _overlayTab = tab;
    if (_chatUnsub) { _chatUnsub(); _chatUnsub = null; }
    renderOverlayChat();
};

// Keep overlay button visible on ALL pages except full chat hub view
var _origRenderChatHub = window.renderChatHub;
window.renderChatHub = function(tab) {
    var btn = document.getElementById('chatOverlayBtn');
    if (btn) btn.style.display = 'none';
    // Shift leaderboard button up when chat hub is open
    var _lbFab2 = document.getElementById('lbFloatBtn');
    if (_lbFab2) _lbFab2.classList.add('chat-shifted');
    if (_overlayOpen) {
        _overlayOpen = false;
        window._chatOverlayOpen = false;
        var panel = document.getElementById('chatOverlay');
        if (panel) panel.style.transform = 'translateY(100%)';
        if (btn) { btn.innerHTML = '💬'; btn.style.background = 'var(--accent,#f7931a)'; btn.style.color = '#fff'; }
        var bd = document.getElementById('chatOverlayBackdrop');
        if (bd) bd.remove();
    }
    return _origRenderChatHub(tab);
};

// Re-show overlay button on ANY navigation (go, goHome, popstate)
function showOverlayBtn() {
    var btn = document.getElementById('chatOverlayBtn');
    // Show on all screen sizes (unless full chat hub is open)
    if (btn && !document.getElementById('chatContent')) btn.style.display = 'block';
}
// Periodically check button visibility (catches app navigations that don't call go())
setInterval(function() {
    var btn = document.getElementById('chatOverlayBtn');
    if (btn && btn.style.display === 'none' && !document.getElementById('chatContent')) {
        btn.style.display = 'block';
    }
}, 3000);

var _origGoHome2 = window.goHome;
if (_origGoHome2) {
    window.goHome = function() {
        showOverlayBtn();
        // Remove chat-shifted from leaderboard FAB when returning home
        var _lbFabHome = document.getElementById('lbFloatBtn');
        if (_lbFabHome) _lbFabHome.classList.remove('chat-shifted');
        return _origGoHome2.apply(this, arguments);
    };
}

var _origGo2 = window.go;
if (_origGo2) {
    window.go = function(id) {
        // Show button on all pages except full chat hub
        if (id !== 'chat') showOverlayBtn();
        // Remove chat-shifted from leaderboard FAB when navigating away from chat hub
        var _lbFabNav = document.getElementById('lbFloatBtn');
        if (_lbFabNav) _lbFabNav.classList.remove('chat-shifted');
        return _origGo2.apply(this, arguments);
    };
}

window.addEventListener('popstate', function() {
    showOverlayBtn();
    // Remove chat-shifted if navigating away from chat hub via back button
    if (!document.getElementById('chatContent')) {
        var _lbFabPop = document.getElementById('lbFloatBtn');
        if (_lbFabPop) _lbFabPop.classList.remove('chat-shifted');
    }
});

// ---- Emoji Reaction System ----
window.showReactPicker = function(msgId, btnEl) {
    var old = document.getElementById('reactPicker');
    if (old) { old.remove(); return; }

    _reactExpanded = false;
    var picker = document.createElement('div');
    picker.id = 'reactPicker';
    var _rIsDark = document.body.getAttribute('data-theme') !== 'light';
    picker.style.cssText = 'position:fixed;z-index:260000;background:' + (_rIsDark ? '#1a1a2e' : '#f0f0f5') + ';border:1px solid var(--border);border-radius:14px;padding:8px;box-shadow:0 8px 32px rgba(0,0,0,0.6);max-width:280px;';

    function renderEmojis() {
        var emojis = _reactExpanded ? REACT_EMOJIS_EXPANDED : REACT_EMOJIS_DEFAULT;
        var html = '<div style="display:flex;flex-wrap:wrap;gap:2px;">';
        for (var i = 0; i < emojis.length; i++) {
            html += '<button onclick="toggleReaction(\'' + msgId + '\',\'' + emojis[i] + '\');document.getElementById(\'reactPicker\').remove()" style="padding:5px 6px;font-size:1.2rem;cursor:pointer;background:none;border:none;border-radius:8px;transition:0.15s;touch-action:manipulation;line-height:1;" onmouseover="this.style.background=\'rgba(255,255,255,0.1)\'" onmouseout="this.style.background=\'none\'">' + emojis[i] + '</button>';
        }
        html += '</div>';
        html += '<button onclick="window._reactExpanded=!window._reactExpanded;window._rerenderReactPicker(\'' + msgId + '\')" style="width:100%;padding:4px;margin-top:4px;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:8px;color:var(--text-faint);font-size:0.65rem;cursor:pointer;font-family:inherit;">' + (_reactExpanded ? '▲ Less' : '▼ More emojis') + '</button>';
        picker.innerHTML = html;
    }

    window._rerenderReactPicker = function() {
        // Delay re-render to avoid click event bubbling to dismiss handler
        setTimeout(renderEmojis, 10);
    };
    renderEmojis();

    // Position near button
    var rect = btnEl.getBoundingClientRect();
    picker.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
    picker.style.left = Math.max(8, Math.min(rect.left - 40, window.innerWidth - 290)) + 'px';
    document.body.appendChild(picker);

    setTimeout(function() {
        document.addEventListener('click', function dismissPicker(e) {
            var p = document.getElementById('reactPicker');
            if (p && !p.contains(e.target)) { p.remove(); document.removeEventListener('click', dismissPicker); }
        });
    }, 50);
};

window.toggleReaction = function(msgId, emoji) {
    if (typeof auth === 'undefined' || !auth || !auth.currentUser) {
        console.warn('[CHAT] Reaction blocked — not authenticated');
        if (typeof showToast === 'function') showToast('Sign in to react!');
        return;
    }
    if (typeof db === 'undefined' || !db) {
        console.warn('[CHAT] Reaction blocked — Firestore not ready');
        return;
    }
    // Validate emoji: must be short, no HTML/script chars
    if (!emoji || emoji.length > 10 || /[<>"'\\&;(){}]/.test(emoji)) return;
    var uid = auth.currentUser.uid;
    var ref = db.collection(CHAT_COLLECTION).doc(msgId);

    ref.get().then(function(doc) {
        if (!doc.exists) { console.warn('[CHAT] Reaction: doc not found', msgId); return; }
        var data = doc.data();
        var reactions = data.reactions || {};
        var users = reactions[emoji] || [];
        var idx = users.indexOf(uid);

        if (idx !== -1) {
            // Remove reaction
            users.splice(idx, 1);
        } else {
            // Add reaction
            users.push(uid);
            var _rc = parseInt(localStorage.getItem('btc_chat_reactions') || '0'); localStorage.setItem('btc_chat_reactions', String(_rc + 1));
        }

        if (users.length === 0) {
            delete reactions[emoji];
        } else {
            reactions[emoji] = users;
        }

        return ref.update({ reactions: reactions });
    }).catch(function(e) {
        console.error('[CHAT] Reaction error:', e);
        if (typeof showToast === 'function') showToast('⚠️ Reaction failed — try again');
    });
};

// ---- GIF Picker ----
window.showGifPicker = function() {
    var old = document.getElementById('gifPicker');
    if (old) { old.remove(); return; }

    var picker = document.createElement('div');
    picker.id = 'gifPicker';
    var _isDark = document.body.getAttribute('data-theme') !== 'light';
    picker.style.cssText = 'position:fixed;bottom:120px;left:50%;transform:translateX(-50%);z-index:260000;background:' + (_isDark ? '#1a1a2e' : '#f0f0f5') + ';border:1px solid var(--border);border-radius:16px;padding:12px;width:90%;max-width:360px;max-height:350px;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.4);';

    picker.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
            '<input type="text" id="gifSearchInput" placeholder="Search GIFs..." style="flex:1;padding:8px 12px;background:var(--input-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.85rem;font-family:inherit;outline:none;" oninput="searchGifs(this.value)">' +
            '<button onclick="document.getElementById(\'gifPicker\').remove()" style="background:none;border:none;color:var(--text-faint);font-size:1.2rem;cursor:pointer;">✕</button>' +
        '</div>' +
        '<div style="font-size:0.6rem;color:var(--text-faint);margin-bottom:6px;">Paste any GIF/image URL, or search Tenor</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">' +
            '<button onclick="searchGifs(\'bitcoin\')" class="gif-tag" style="padding:4px 10px;border-radius:8px;background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.2);color:var(--accent);font-size:0.7rem;cursor:pointer;font-family:inherit;">₿ Bitcoin</button>' +
            '<button onclick="searchGifs(\'lightning\')" class="gif-tag" style="padding:4px 10px;border-radius:8px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.2);color:#6366f1;font-size:0.7rem;cursor:pointer;font-family:inherit;">⚡ Lightning</button>' +
            '<button onclick="searchGifs(\'celebration\')" class="gif-tag" style="padding:4px 10px;border-radius:8px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);color:#22c55e;font-size:0.7rem;cursor:pointer;font-family:inherit;">🎉 Celebrate</button>' +
            '<button onclick="searchGifs(\'funny\')" class="gif-tag" style="padding:4px 10px;border-radius:8px;background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.2);color:#eab308;font-size:0.7rem;cursor:pointer;font-family:inherit;">😂 Funny</button>' +
        '</div>' +
        '<div id="gifResults" style="flex:1;overflow-y:auto;display:grid;grid-template-columns:repeat(2,1fr);gap:6px;min-height:100px;">' +
            '<div style="grid-column:1/-1;text-align:center;color:var(--text-faint);font-size:0.8rem;padding:20px;">Type to search or paste a GIF URL</div>' +
        '</div>' +
        '<div style="margin-top:6px;display:flex;gap:6px;">' +
            '<input type="text" id="gifUrlInput" placeholder="Or paste image/GIF URL..." style="flex:1;padding:6px 10px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.75rem;font-family:inherit;outline:none;">' +
            '<button onclick="sendGifUrl()" style="padding:6px 12px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:0.75rem;font-weight:700;cursor:pointer;font-family:inherit;">Send</button>' +
        '</div>';

    document.body.appendChild(picker);
    document.getElementById('gifSearchInput').focus();
};

var _gifSearchTimer = null;
window.searchGifs = function(query) {
    if (_gifSearchTimer) clearTimeout(_gifSearchTimer);
    var el = document.getElementById('gifResults');
    if (!el) return;
    if (!query || query.length < 2) {
        el.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-faint);font-size:0.8rem;padding:20px;">Type to search</div>';
        return;
    }
    // Track GIF search use for Search Sleuth badge
    try { var _ss = typeof safeJSON === 'function' ? safeJSON('btc_searches_used', []) : JSON.parse(localStorage.getItem('btc_searches_used') || '[]'); if (_ss.indexOf('gif') === -1) { _ss.push('gif'); localStorage.setItem('btc_searches_used', JSON.stringify(_ss)); } } catch(e) {}
    var input = document.getElementById('gifSearchInput');
    if (input && input.value !== query) input.value = query;
    el.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-faint);font-size:0.8rem;padding:20px;">Searching...</div>';

    _gifSearchTimer = setTimeout(function() {
        // Use Tenor v1 API (free, anonymous key)
        fetch('https://g.tenor.com/v1/search?q=' + encodeURIComponent(query) + '&key=LIVDSRZULELA&limit=20&media_filter=minimal')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.results || data.results.length === 0) {
                    el.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-faint);font-size:0.8rem;padding:20px;">No GIFs found</div>';
                    return;
                }
                var html = '';
                for (var i = 0; i < data.results.length; i++) {
                    var gif = data.results[i];
                    var media = gif.media && gif.media[0] ? gif.media[0] : {};
                    var url = media.tinygif ? media.tinygif.url : (media.nanogif ? media.nanogif.url : '');
                    var fullUrl = media.gif ? media.gif.url : (media.mediumgif ? media.mediumgif.url : url);
                    if (!url) continue;
                    html += '<img src="' + url + '" onclick="previewGifBeforeSend(\'' + fullUrl.replace(/[\\'"]/g, "") + '\')" style="width:100%;border-radius:8px;cursor:pointer;object-fit:cover;height:100px;transition:0.15s;" loading="lazy" onmouseover="this.style.transform=\'scale(1.05)\'" onmouseout="this.style.transform=\'scale(1)\'">';
                }
                el.innerHTML = html || '<div style="grid-column:1/-1;text-align:center;color:var(--text-faint);font-size:0.8rem;padding:20px;">No GIFs found</div>';
            })
            .catch(function() {
                el.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-faint);font-size:0.8rem;padding:20px;">Search failed — try pasting a URL instead</div>';
            });
    }, 400);
};

window.previewGifBeforeSend = function(url) {
    if (!url) return;
    // Close the GIF picker
    var picker = document.getElementById('gifPicker');
    if (picker) picker.remove();
    // Stage like image preview
    window._chatPendingImage = url;
    window._chatPendingIsGif = true;
    var old = document.getElementById('chatImagePreview');
    if (old) old.remove();
    var preview = document.createElement('div');
    preview.id = 'chatImagePreview';
    preview.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 12px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.3);border-radius:10px;margin-bottom:6px;';
    preview.innerHTML =
        '<img src="' + url + '" style="width:48px;height:48px;object-fit:cover;border-radius:6px;border:1px solid var(--border);">' +
        '<div style="flex:1;min-width:0;"><div style="color:var(--text);font-size:0.8rem;font-weight:600;">GIF ready</div><div style="color:var(--text-faint);font-size:0.7rem;">Press Send to share</div></div>' +
        '<button onclick="cancelImagePreview()" style="background:none;border:none;color:var(--text-faint);font-size:1rem;cursor:pointer;padding:4px;">✕</button>';
    var containers = document.querySelectorAll('#globalChatInput');
    containers.forEach(function(inp) {
        var wrap = inp.closest('div');
        if (wrap && wrap.parentElement) {
            wrap.parentElement.insertBefore(preview.cloneNode(true), wrap);
        }
    });
};

window.enlargeChatImage = function(src) {
    var old = document.getElementById('chatImageLightbox');
    if (old) { old.remove(); return; }
    var lb = document.createElement('div');
    lb.id = 'chatImageLightbox';
    lb.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;padding:20px;cursor:pointer;';
    lb.onclick = function() { lb.remove(); };
    var img = document.createElement('img');
    img.src = src;
    img.style.cssText = 'max-width:95%;max-height:90vh;border-radius:12px;object-fit:contain;box-shadow:0 8px 40px rgba(0,0,0,0.5);pointer-events:none;';
    lb.appendChild(img);
    document.body.appendChild(lb);
};

window.sendGifMessage = function(url, caption) {
    if (!url) return;
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        if (typeof showToast === 'function') showToast('Sign in to send GIFs!');
        return;
    }
    var username = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : null;
    if (!username) { if (typeof showToast === 'function') showToast('Set a username first!'); return; }

    // Rate limit
    var now = Date.now();
    if (now - _lastSendTime < RATE_LIMIT_MS) {
        if (typeof showToast === 'function') showToast('Slow down!');
        return;
    }
    _lastSendTime = now;

    // Build message data
    var msgData = {
        uid: auth.currentUser.uid,
        name: username,
        text: url,
        isGif: true,
        isNachoAuto: false,
        ts: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.faction) msgData.faction = currentUser.faction;

    // Include reply if active
    if (_replyTo) {
        msgData.replyTo = _replyTo._id;
        msgData.replyToName = _replyTo.name;
        msgData.replyToText = _replyTo.text;
        _replyTo = null;
        var banner = document.getElementById('chatReplyBanner');
        if (banner) banner.style.display = 'none';
    }

    db.collection(CHAT_COLLECTION).add(msgData).then(function() {
        bridgeToTelegram({ user: username, text: '', gifUrl: url });
    }).catch(function(e) {
        if (typeof showToast === 'function') showToast('Failed to send GIF');
    });

    // Close picker
    var picker = document.getElementById('gifPicker');
    if (picker) picker.remove();
};

window.sendGifUrl = function() {
    var input = document.getElementById('gifUrlInput');
    if (!input || !input.value.trim()) return;
    var url = input.value.trim();
    if (!IMG_REGEX.test(url)) {
        if (typeof showToast === 'function') showToast('Must be a direct image URL (.gif, .png, .jpg, .webp)');
        return;
    }
    previewGifBeforeSend(url);
};

// ---- Emoji Picker (for message input) ----
var EMOJI_CATEGORIES = {
    'Smileys': ['😀','😂','🤣','😊','😍','🥰','😎','🤩','😤','😡','😢','😭','🥺','😱','🤯','🤔','🤫','🤭','😏','😈','💀','☠️','🤡','👻','😴','🥳','😇','🙄','😬','😮‍💨'],
    'Gestures': ['👍','👎','👏','🙌','🤝','🤜🤛','✊','👊','🫡','💪','🙏','👀','🫂','🤷','🤦','✌️','🤘','👌','🖕','👋','🫶'],
    'Bitcoin': ['₿','⚡','⛏️','🔑','🧡','💎','🚀','🐋','📈','📉','🪙','🛡️','🔒','🗝️','💰','🏦','💸','🐂','🐻','📊'],
    'Objects': ['🔥','💯','🎉','🎊','🏆','🥇','🎯','💡','⭐','❤️','🧡','💛','💚','💙','💜','🖤','❌','✅','⬆️','⬇️','🍿','🍕','🍺','🎵','📱','💻','🎮','🎲','⏰','📢']
};

window.showEmojiPicker = function() {
    var old = document.getElementById('gcEmojiPicker');
    if (old) { old.remove(); return; }

    var picker = document.createElement('div');
    picker.id = 'gcEmojiPicker';
    var _isDark = document.body.getAttribute('data-theme') !== 'light';
    picker.style.cssText = 'position:fixed;bottom:120px;left:50%;transform:translateX(-50%);z-index:260000;background:' + (_isDark ? '#1a1a2e' : '#f0f0f5') + ';border:1px solid var(--border);border-radius:16px;padding:12px;width:90%;max-width:340px;max-height:320px;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.4);';

    var cats = Object.keys(EMOJI_CATEGORIES);
    var tabHtml = '<div style="display:flex;gap:2px;margin-bottom:8px;overflow-x:auto;">';
    cats.forEach(function(cat, i) {
        var label = cat === 'Smileys' ? '😀' : cat === 'Gestures' ? '👍' : cat === 'Bitcoin' ? '₿' : '🔥';
        tabHtml += '<button onclick="window._switchEmojiTab(\'' + cat + '\')" id="emojiTab_' + i + '" style="padding:6px 10px;font-size:1rem;cursor:pointer;background:' + (i === 0 ? 'var(--accent-bg)' : 'none') + ';border:1px solid ' + (i === 0 ? 'var(--accent)' : 'var(--border)') + ';border-radius:10px;flex-shrink:0;touch-action:manipulation;" title="' + cat + '">' + label + '</button>';
    });
    tabHtml += '<button onclick="document.getElementById(\'gcEmojiPicker\').remove()" style="margin-left:auto;padding:4px 8px;background:none;border:none;color:var(--text-faint);font-size:1rem;cursor:pointer;flex-shrink:0;">\u2715</button></div>';

    picker.innerHTML = tabHtml + '<div id="emojiGrid" style="display:flex;flex-wrap:wrap;gap:2px;overflow-y:auto;max-height:240px;justify-content:center;"></div>';

    // Insert before the chat input container
    var chatWrap = document.getElementById('globalChatInput');
    if (chatWrap) {
        var container = chatWrap.closest('[style*="flex-shrink"]') || chatWrap.parentElement.parentElement.parentElement;
        container.insertBefore(picker, container.firstChild);
    } else {
        document.body.appendChild(picker);
    }

    window._switchEmojiTab(cats[0]);
};

window._switchEmojiTab = function(cat) {
    var grid = document.getElementById('emojiGrid');
    if (!grid) return;
    var emojis = EMOJI_CATEGORIES[cat] || [];
    var html = '';
    emojis.forEach(function(e) {
        html += '<button onclick="window._insertEmoji(\'' + e + '\')" style="padding:6px;font-size:1.3rem;cursor:pointer;background:none;border:none;border-radius:8px;transition:0.1s;touch-action:manipulation;line-height:1;" onmouseover="this.style.background=\'rgba(255,255,255,0.1)\'" onmouseout="this.style.background=\'none\'">' + e + '</button>';
    });
    grid.innerHTML = html;

    // Update tab styles
    var cats = Object.keys(EMOJI_CATEGORIES);
    cats.forEach(function(c, i) {
        var tab = document.getElementById('emojiTab_' + i);
        if (tab) {
            tab.style.background = (c === cat) ? 'var(--accent-bg)' : 'none';
            tab.style.borderColor = (c === cat) ? 'var(--accent)' : 'var(--border)';
        }
    });
};

window._insertEmoji = function(emoji) {
    var input = document.getElementById('globalChatInput');
    if (!input) return;
    var start = input.selectionStart || input.value.length;
    var end = input.selectionEnd || start;
    input.value = input.value.substring(0, start) + emoji + input.value.substring(end);
    input.focus();
    var newPos = start + emoji.length;
    input.setSelectionRange(newPos, newPos);
    // Update char counter
    var counter = document.getElementById('globalChatCharCount');
    if (counter) counter.textContent = input.value.length;
};

// ---- Image Upload ----
window.chatUploadImage = function() {
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        if (typeof showToast === 'function') showToast('Sign in to upload images!');
        return;
    }
    var username = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : null;
    if (!username) { if (typeof showToast === 'function') showToast('Set a username first!'); return; }

    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.gif';
    input.style.display = 'none';
    input.onchange = function() {
        var file = input.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            if (typeof showToast === 'function') showToast('Image too large (max 10MB)');
            return;
        }
        if (!file.type.startsWith('image/')) {
            if (typeof showToast === 'function') showToast('Only images are allowed');
            return;
        }

        // Stage image for preview (don't send yet)
        if (file.type === 'image/gif') {
            readAndPreview(file);
        } else {
            compressAndPreview(file);
        }
    };
    document.body.appendChild(input);
    input.click();
    setTimeout(function() { input.remove(); }, 60000);
};

// Stage image data for preview
window._chatPendingImage = null;      // dataURL (for preview display only)
window._chatPendingImageBlob = null;  // Blob/File (for Storage upload)
window._chatPendingImageType = null;  // mime type for upload

function compressAndPreview(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
        var img = new Image();
        img.onload = function() {
            var canvas = document.createElement('canvas');
            var maxDim = 1200;
            var w = img.width, h = img.height;
            if (w > maxDim || h > maxDim) {
                if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
                else { w = Math.round(w * maxDim / h); h = maxDim; }
            }
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            var dataUrl = canvas.toDataURL('image/jpeg', 0.65);
            // Also produce a Blob for Storage upload
            canvas.toBlob(function(blob) {
                window._chatPendingImageBlob = blob || null;
                window._chatPendingImageType = 'image/jpeg';
                showImagePreview(dataUrl);
            }, 'image/jpeg', 0.65);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function readAndPreview(file) {
    // Used for GIFs/PNGs where we don't recompress. Keep the original File for upload.
    if (file.size > 5 * 1024 * 1024) {
        if (typeof showToast === 'function') showToast('Image too large. Max 5MB.');
        return;
    }
    var reader = new FileReader();
    reader.onload = function(e) {
        var dataUrl = e.target.result;
        window._chatPendingImageBlob = file;
        window._chatPendingImageType = file.type || 'image/png';
        showImagePreview(dataUrl);
    };
    reader.readAsDataURL(file);
}

function showImagePreview(dataUrl) {
    window._chatPendingImage = dataUrl;
    // Remove existing preview
    var old = document.getElementById('chatImagePreview');
    if (old) old.remove();
    // Insert preview above the input area
    var preview = document.createElement('div');
    preview.id = 'chatImagePreview';
    preview.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 12px;background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.3);border-radius:10px;margin-bottom:6px;';
    preview.innerHTML =
        '<img src="' + dataUrl + '" style="width:48px;height:48px;object-fit:cover;border-radius:6px;border:1px solid var(--border);">' +
        '<div style="flex:1;min-width:0;"><div style="color:var(--text);font-size:0.8rem;font-weight:600;">📷 Image ready</div><div style="color:var(--text-faint);font-size:0.7rem;">Press Send to share</div></div>' +
        '<button onclick="cancelImagePreview()" style="background:none;border:none;color:var(--text-faint);font-size:1rem;cursor:pointer;padding:4px;">✕</button>';
    // Find the input container to insert before it
    var containers = document.querySelectorAll('#globalChatInput');
    containers.forEach(function(inp) {
        var wrap = inp.closest('div');
        if (wrap && wrap.parentElement) {
            wrap.parentElement.insertBefore(preview.cloneNode(true), wrap);
        }
    });
}

window.cancelImagePreview = function() {
    window._chatPendingImage = null;
    document.querySelectorAll('#chatImagePreview').forEach(function(el) { el.remove(); });
};

function sendImageMessage(dataUrl, caption, imgBlob, imgType) {
    if (!auth || !auth.currentUser) return;
    // C2: Validate data URL is actually an image (kept for safety; we now primarily use the Blob)
    if (dataUrl && dataUrl.startsWith('data:') && !dataUrl.startsWith('data:image/')) {
        if (typeof showToast === 'function') showToast('Invalid image format');
        return;
    }
    var username = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'Anon';
    var now = Date.now();
    if (now - _lastSendTime < RATE_LIMIT_MS) {
        if (typeof showToast === 'function') showToast('Slow down!');
        return;
    }
    _lastSendTime = now;

    // We need Firebase Storage to upload the image and get a real https URL.
    // Firestore rules require text to match ^https://.* for isGif messages.
    var storage = null;
    try { storage = firebase.storage(); } catch(e) {}
    if (!storage || !imgBlob) {
        if (typeof showToast === 'function') showToast('Image upload unavailable. Try again.');
        return;
    }

    var uid = auth.currentUser.uid;
    var ext = (imgType && imgType.indexOf('png') > -1) ? 'png'
            : (imgType && imgType.indexOf('gif') > -1) ? 'gif'
            : (imgType && imgType.indexOf('webp') > -1) ? 'webp'
            : 'jpg';
    var fileName = Date.now() + '_' + Math.random().toString(36).substr(2, 6) + '.' + ext;
    var ref = storage.ref('chat-images/' + uid + '/' + fileName);

    if (typeof showToast === 'function') showToast('Uploading image…');

    // Capture reply state now so it can't be mutated mid-upload
    var replyCopy = _replyTo ? {
        id: _replyTo._id, name: _replyTo.name, text: _replyTo.text
    } : null;
    if (_replyTo) {
        _replyTo = null;
        var banner = document.getElementById('chatReplyBanner');
        if (banner) banner.style.display = 'none';
    }

    ref.put(imgBlob, { contentType: imgType || 'image/jpeg' })
       .then(function(snap) { return snap.ref.getDownloadURL(); })
       .then(function(url) {
            var msgData = {
                uid: auth.currentUser.uid,
                name: username,
                text: url,
                isGif: true,
                isNachoAuto: false,
                ts: firebase.firestore.FieldValue.serverTimestamp()
            };
            if (caption) msgData.caption = caption;
            if (typeof currentUser !== 'undefined' && currentUser && currentUser.faction) msgData.faction = currentUser.faction;
            if (replyCopy) {
                msgData.replyTo = replyCopy.id;
                msgData.replyToName = replyCopy.name;
                msgData.replyToText = replyCopy.text;
            }

            // If there's a caption, also send it as a separate text message so it shows in chat
            if (caption) {
                db.collection(CHAT_COLLECTION).add({
                    uid: auth.currentUser.uid, name: username, text: caption,
                    ts: firebase.firestore.FieldValue.serverTimestamp()
                }).catch(function() {});
            }

            return db.collection(CHAT_COLLECTION).add(msgData).then(function() {
                if (typeof showToast === 'function') showToast('📷 Image sent!');
                // Bridge https URL to Telegram
                bridgeToTelegram({ user: username, text: caption || '', imageUrl: url });
            });
        })
       .catch(function(e) {
            console.error('[Chat Image] Upload failed:', e);
            if (typeof showToast === 'function') showToast('Failed to send image: ' + (e.message || e.code || 'upload error'));
        });
}

// =============================================
// 🎧 DJ Mode — Broadcast Beats to Global Chat (with queue)
// =============================================
var DJ_DOC = 'live_dj';
var DJ_QUEUE_COL = 'dj_queue';
var DJ_MAX_SONGS_WITH_QUEUE = 5;
var _djUnsub = null;
var _djQueueUnsub = null;
var _djAudio = null;
var _djListening = false;
var _djSongCount = 0; // tracks how many songs the current DJ has played
var _djIsMe = false;
var _djQueuePosition = -1; // -1 = not in queue

// DJ broadcasts: go live or join queue
window.djBroadcast = function() {
    if (!window._beatsNowPlaying || !window._beatsAudio) {
        if (typeof showToast === 'function') showToast('Play a song in Bitcoin Beats first!');
        return;
    }
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        if (typeof showToast === 'function') showToast('Sign in to DJ!');
        return;
    }
    var username = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : null;
    if (!username) { if (typeof showToast === 'function') showToast('Set a username first!'); return; }

    var track = window._beatsQueue[window._beatsQueueIdx];
    if (!track) return;
    var uid = auth.currentUser.uid;

    // Check if someone is already DJing
    db.collection('global_chat_meta').doc(DJ_DOC).get().then(function(doc) {
        var data = doc.exists ? doc.data() : null;
        if (data && data.active && data.djUid !== uid && data.djUid !== 'nacho-dj') {
            // A real DJ is playing — join the queue
            djJoinQueue(uid, username);
        } else {
            // Booth is open, Nacho is playing, or we're already the DJ — go live
            djGoLive(uid, username, track);
        }
    }).catch(function() {
        // If doc doesn't exist, booth is open
        djGoLive(uid, username, track);
    });
};

// ---- Floating DJ Controls Panel ----
window.showDJControlPanel = function() {
    var existing = document.getElementById('djControlPanel');
    if (existing) { existing.style.display = 'flex'; return; }

    var panel = document.createElement('div');
    panel.id = 'djControlPanel';
    panel.style.cssText = 'position:fixed;bottom:80px;right:16px;z-index:310;width:280px;background:var(--bg-side,#1a1a2e);border:2px solid #6366f1;border-radius:16px;box-shadow:0 8px 32px rgba(99,102,241,0.3);display:flex;flex-direction:column;transition:0.3s;overflow:hidden;';

    panel.innerHTML =
        '<div onclick="var body=document.getElementById(\'djControlBody\');var arrow=document.getElementById(\'djControlArrow\');if(body.style.display===\'none\'){body.style.display=\'block\';arrow.textContent=\'▼\'}else{body.style.display=\'none\';arrow.textContent=\'▶\'}" style="padding:10px 14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;border-bottom:1px solid var(--border);">' +
            '<span style="font-weight:700;font-size:0.85rem;color:#6366f1;">🎛️ DJ Controls</span>' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
                '<span id="djControlArrow" style="color:var(--text-faint);font-size:0.8rem;">▼</span>' +
                '<span onclick="event.stopPropagation();document.getElementById(\'djControlPanel\').style.display=\'none\'" style="color:var(--text-faint);font-size:1rem;cursor:pointer;padding:2px 6px;">✕</span>' +
            '</div>' +
        '</div>' +
        '<div id="djControlBody" style="padding:12px;max-height:50vh;overflow-y:auto;">' +
            // Now Playing
            '<div id="djControlNowPlaying" style="font-size:0.8rem;color:var(--heading);font-weight:600;margin-bottom:10px;">♫ Broadcasting...</div>' +

            // Volume
            '<div style="margin-bottom:12px;">' +
                '<div style="color:var(--text-faint);font-size:0.7rem;margin-bottom:4px;">🔊 My Volume <span style="opacity:0.6;font-size:0.6rem;">(local only — listeners have their own)</span></div>' +
                '<input type="range" min="0" max="100" value="' + Math.round((window._beatsAudio ? window._beatsAudio.volume : 0.8) * 100) + '" style="width:100%;accent-color:var(--accent);" oninput="if(window._beatsAudio)window._beatsAudio.volume=this.value/100">' +
            '</div>' +

            // Sound Effects
            '<div style="margin-bottom:12px;">' +
                '<div style="color:var(--text-faint);font-size:0.7rem;margin-bottom:6px;">🔊 Sound Effects</div>' +
                '<div style="display:flex;flex-wrap:wrap;gap:5px;">' +
                    '<button onclick="djPlaySFX(\'horn\')" style="padding:6px 10px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;color:#ef4444;font-size:0.75rem;font-weight:700;cursor:pointer;font-family:inherit;">📯 Horn</button>' +
                    '<button onclick="djPlaySFX(\'airhorn\')" style="padding:6px 10px;background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.3);border-radius:8px;color:#eab308;font-size:0.75rem;font-weight:700;cursor:pointer;font-family:inherit;">📢 Airhorn</button>' +
                    '<button onclick="djPlaySFX(\'scratch\')" style="padding:6px 10px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.3);border-radius:8px;color:#6366f1;font-size:0.75rem;font-weight:700;cursor:pointer;font-family:inherit;">💿 Scratch</button>' +
                    '<button onclick="djPlaySFX(\'rewind\')" style="padding:6px 10px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:8px;color:#22c55e;font-size:0.75rem;font-weight:700;cursor:pointer;font-family:inherit;">⏪ Rewind</button>' +
                    '<button onclick="djPlaySFX(\'boom\')" style="padding:6px 10px;background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.3);border-radius:8px;color:#a855f7;font-size:0.75rem;font-weight:700;cursor:pointer;font-family:inherit;">💥 Boom</button>' +
                    '<button onclick="djPlaySFX(\'applause\')" style="padding:6px 10px;background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.3);border-radius:8px;color:var(--accent);font-size:0.75rem;font-weight:700;cursor:pointer;font-family:inherit;">👏 Applause</button>' +
                '</div>' +
            '</div>' +

            // Up Next Queue
            '<div style="margin-bottom:12px;">' +
                '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">' +
                    '<span style="color:var(--text-faint);font-size:0.7rem;">🎵 Up Next</span>' +
                    '<button onclick="djShowTrackPicker()" style="padding:3px 8px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);border-radius:6px;color:#6366f1;font-size:0.65rem;font-weight:700;cursor:pointer;font-family:inherit;">+ Add Track</button>' +
                '</div>' +
                '<div id="djUpNextList" style="display:flex;flex-direction:column;gap:4px;"></div>' +
            '</div>' +

            // Stop Button
            '<button onclick="djStopBroadcast();var p=document.getElementById(\'djControlPanel\');if(p)p.remove();" style="width:100%;padding:10px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);border-radius:10px;color:#ef4444;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">⏹ Stop Broadcasting</button>' +
        '</div>';

    document.body.appendChild(panel);

    // Update now playing text
    function updateDJPanel() {
        var np = document.getElementById('djControlNowPlaying');
        if (!np) return;
        var track = window._beatsQueue && window._beatsQueue[window._beatsQueueIdx];
        if (track) np.textContent = '♫ ' + (track.title || 'Untitled') + ' — ' + (track.artist || track.authorName || 'Unknown');
    }
    updateDJPanel();
    window._djPanelInterval = setInterval(updateDJPanel, 3000);
};

// ---- DJ Queue (up to 3 tracks) ----
window._djUpNext = [];

function djRenderUpNext() {
    var el = document.getElementById('djUpNextList');
    if (!el) return;
    if (window._djUpNext.length === 0) {
        el.innerHTML = '<div style="color:var(--text-faint);font-size:0.7rem;font-style:italic;padding:4px;">No tracks queued. Add up to 3.</div>';
        return;
    }
    var html = '';
    for (var i = 0; i < window._djUpNext.length; i++) {
        var t = window._djUpNext[i];
        html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--card-bg,#111);border:1px solid var(--border);border-radius:8px;">' +
            '<span style="color:var(--accent);font-weight:700;font-size:0.7rem;">' + (i + 1) + '</span>' +
            '<div style="flex:1;min-width:0;overflow:hidden;">' +
                '<div style="font-size:0.75rem;color:var(--heading);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (typeof escapeHtml === 'function' ? escapeHtml(t.title || 'Untitled') : (t.title || 'Untitled')) + '</div>' +
                '<div style="font-size:0.65rem;color:var(--text-faint);">' + (typeof escapeHtml === 'function' ? escapeHtml(t.artist || t.authorName || '') : (t.artist || t.authorName || '')) + '</div>' +
            '</div>' +
            '<span onclick="window._djUpNext.splice(' + i + ',1);djRenderUpNext()" style="cursor:pointer;font-size:0.7rem;color:#ef4444;padding:2px 4px;" title="Remove">✕</span>' +
        '</div>';
    }
    el.innerHTML = html;
}

window.djShowTrackPicker = function() {
    if (window._djUpNext.length >= 3) {
        if (typeof showToast === 'function') showToast('Queue is full (max 3 tracks)');
        return;
    }
    var existing = document.getElementById('djTrackPicker');
    if (existing) { existing.remove(); return; }

    var tracks = window._beatsQueue || [];
    if (tracks.length === 0) {
        if (typeof showToast === 'function') showToast('No tracks loaded. Open Bitcoin Beats first.');
        return;
    }

    var picker = document.createElement('div');
    picker.id = 'djTrackPicker';
    picker.style.cssText = 'position:fixed;bottom:80px;right:16px;z-index:320;width:280px;max-height:300px;background:var(--bg-side,#1a1a2e);border:2px solid var(--accent);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.5);display:flex;flex-direction:column;overflow:hidden;';

    var searchHtml = '<div style="padding:8px;border-bottom:1px solid var(--border);">' +
        '<input id="djTrackSearch" type="text" placeholder="Search tracks..." style="width:100%;padding:8px 10px;background:var(--input-bg,#111);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.8rem;font-family:inherit;outline:none;box-sizing:border-box;" oninput="djFilterTracks(this.value)">' +
    '</div>';

    var listHtml = '<div id="djTrackPickerList" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;max-height:240px;">';
    for (var i = 0; i < tracks.length; i++) {
        var t = tracks[i];
        var esc = typeof escapeHtml === 'function' ? escapeHtml : function(s) { return s; };
        listHtml += '<div class="djPickerItem" data-search="' + esc((t.title || '') + ' ' + (t.artist || t.authorName || '')).toLowerCase() + '" onclick="djAddToQueue(' + i + ')" style="padding:8px 10px;cursor:pointer;border-bottom:1px solid var(--border);transition:0.15s;" onmouseover="this.style.background=\'rgba(99,102,241,0.1)\'" onmouseout="this.style.background=\'none\'">' +
            '<div style="font-size:0.8rem;color:var(--heading);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(t.title || 'Untitled') + '</div>' +
            '<div style="font-size:0.65rem;color:var(--text-faint);">' + esc(t.artist || t.authorName || 'Unknown') + '</div>' +
        '</div>';
    }
    listHtml += '</div>';

    picker.innerHTML = searchHtml + listHtml;
    document.body.appendChild(picker);
    setTimeout(function() { var s = document.getElementById('djTrackSearch'); if (s) s.focus(); }, 100);
};

window.djFilterTracks = function(query) {
    var q = query.toLowerCase();
    var items = document.querySelectorAll('.djPickerItem');
    items.forEach(function(el) {
        el.style.display = (el.getAttribute('data-search') || '').indexOf(q) >= 0 ? '' : 'none';
    });
};

window.djAddToQueue = function(idx) {
    if (window._djUpNext.length >= 3) {
        if (typeof showToast === 'function') showToast('Queue full (max 3)');
        return;
    }
    var tracks = window._beatsQueue || [];
    var t = tracks[idx];
    if (!t) return;
    // Don't add duplicates
    for (var i = 0; i < window._djUpNext.length; i++) {
        if (window._djUpNext[i].id === t.id) {
            if (typeof showToast === 'function') showToast('Already in queue');
            return;
        }
    }
    window._djUpNext.push(t);
    djRenderUpNext();
    if (typeof showToast === 'function') showToast('🎵 Added: ' + (t.title || 'Untitled'));
    var picker = document.getElementById('djTrackPicker');
    if (picker) picker.remove();
};

// Auto-play next from DJ queue when current song ends
var _origBeatsOnEnded = null;
function hookDJAutoQueue() {
    if (!window._beatsAudio || _origBeatsOnEnded) return;
    _origBeatsOnEnded = window._beatsAudio.onended;
    window._beatsAudio.onended = function() {
        if (_djIsMe && window._djUpNext.length > 0) {
            var next = window._djUpNext.shift();
            djRenderUpNext();
            // Find track index in queue
            var tracks = window._beatsQueue || [];
            for (var i = 0; i < tracks.length; i++) {
                if (tracks[i].id === next.id) {
                    if (typeof beatsPlayTrack === 'function') beatsPlayTrack(i);
                    return;
                }
            }
            // Track not in current list — try playing by URL
            if (next.audioUrl && typeof beatsPlayTrack === 'function') {
                window._beatsQueue.push(next);
                beatsPlayTrack(window._beatsQueue.length - 1);
            }
        } else if (_origBeatsOnEnded) {
            _origBeatsOnEnded();
        }
    };
}

// Hide DJ panel on stop
var _origDjStop = window.djStopBroadcast;

function djGoLive(uid, username, track) {
    _djSongCount = 1;
    _djIsMe = true;

    var djData = {
        djUid: uid,
        djName: username,
        trackTitle: track.title || 'Untitled',
        trackArtist: track.artist || track.authorName || 'Unknown',
        trackCoverArt: track.coverArt || '',
        trackAudioUrl: track.audioUrl || '',
        trackId: track.id || '',
        artistUid: track.authorId || '',
        songCount: 1,
        startedAt: firebase.firestore.FieldValue.serverTimestamp(),
        active: true
    };

    db.collection('global_chat_meta').doc(DJ_DOC).set(djData).then(function() {
        if (typeof showToast === 'function') showToast('🎧 You\'re now DJing! Broadcasting to Global Chat');
        window._djUpNext = [];
        showDJControlPanel();
        djRenderUpNext();
        setTimeout(hookDJAutoQueue, 500);

        // Track DJ sets
        var djSets = parseInt(localStorage.getItem('btc_dj_sets') || '0') + 1;
        localStorage.setItem('btc_dj_sets', djSets);
        var djSongs = parseInt(localStorage.getItem('btc_dj_songs') || '0') + 1;
        localStorage.setItem('btc_dj_songs', djSongs);

        // Award points for DJing
        if (typeof awardPoints === 'function') awardPoints(15, '🎧 DJ Set started!');
        if (typeof awardTickets === 'function') awardTickets(5, '🎧 DJ Set');
        if (djSets === 1 && typeof awardPoints === 'function') awardPoints(25, '🎧 First DJ Set!');
        if (djSets === 5 && typeof awardPoints === 'function') awardPoints(30, '🎛️ Resident DJ — 5 sets!');
        if (djSets === 25 && typeof awardPoints === 'function') awardPoints(75, '🏆 Club Legend — 25 sets!');
        db.collection(CHAT_COLLECTION).add({
            uid: 'system', name: '🎧 DJ Mode',
            text: '🎶 @' + username + ' is now DJing! Playing: "' + (track.title || 'Untitled') + '" by ' + (track.artist || track.authorName || 'Unknown') + '. Tune in! 🔊',
            ts: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(function() {});
        // Remove self from queue if was there
        db.collection('global_chat_meta').doc(DJ_DOC).collection(DJ_QUEUE_COL).doc(uid).delete().catch(function() {});
    }).catch(function(e) {
        if (typeof showToast === 'function') showToast('Failed to start DJ: ' + e.message);
    });

    // Track watcher: detect song changes + enforce 5-song limit when queue exists
    if (window._djTrackWatcher) clearInterval(window._djTrackWatcher);
    var lastTrackIdx = window._beatsQueueIdx;
    window._djTrackWatcher = setInterval(function() {
        if (!window._beatsAudio || window._beatsAudio.paused) {
            djStopBroadcast();
            return;
        }
        var updateData = {};
        // Always broadcast playback position for sync
        if (window._beatsAudio.currentTime) {
            updateData.playbackTime = Math.round(window._beatsAudio.currentTime * 10) / 10;
            updateData.playbackUpdatedAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        if (window._beatsQueueIdx !== lastTrackIdx) {
            lastTrackIdx = window._beatsQueueIdx;
            _djSongCount++;
            var t = window._beatsQueue[lastTrackIdx];
            if (t) {
                updateData.trackTitle = t.title || 'Untitled';
                updateData.trackArtist = t.artist || t.authorName || 'Unknown';
                updateData.trackCoverArt = t.coverArt || '';
                updateData.trackAudioUrl = t.audioUrl || '';
                updateData.trackId = t.id || '';
                updateData.artistUid = t.authorId || '';
                updateData.songCount = _djSongCount;
                updateData.playbackTime = 0;

                // Track DJ songs broadcast
                var djSongs = parseInt(localStorage.getItem('btc_dj_songs') || '0') + 1;
                localStorage.setItem('btc_dj_songs', djSongs);
                if (typeof awardPoints === 'function') awardPoints(3, '🎵 Song broadcast');
                if (djSongs === 10 && typeof awardPoints === 'function') awardPoints(15, '📻 10 songs broadcast!');
                if (djSongs === 50 && typeof awardPoints === 'function') awardPoints(30, '🎵 50 songs broadcast!');
                if (djSongs === 100 && typeof awardPoints === 'function') awardPoints(75, '💿 100 songs broadcast!');
            }
            checkDJSongLimit();
        }
        if (Object.keys(updateData).length > 0) {
            db.collection('global_chat_meta').doc(DJ_DOC).update(updateData).catch(function() {});
        }
    }, 1500); // Broadcast every 1.5s for tighter sync
}

function checkDJSongLimit() {
    if (_djSongCount < DJ_MAX_SONGS_WITH_QUEUE) return;
    db.collection('global_chat_meta').doc(DJ_DOC).collection(DJ_QUEUE_COL)
        .orderBy('joinedAt').limit(1).get().then(function(snap) {
            if (!snap.empty) {
                if (typeof showToast === 'function') showToast('🎧 Your 5-song set is done! Passing the booth to the next DJ. 🎶');
                djStopBroadcast();
            }
            // No one in queue — keep playing unlimited
        }).catch(function() {});
}

function djJoinQueue(uid, username) {
    db.collection('global_chat_meta').doc(DJ_DOC).collection(DJ_QUEUE_COL).doc(uid).set({
        uid: uid,
        name: username,
        joinedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function() {
        // Get position in queue
        db.collection('global_chat_meta').doc(DJ_DOC).collection(DJ_QUEUE_COL)
            .orderBy('joinedAt').get().then(function(snap) {
                var pos = 0;
                snap.forEach(function(d, i) { if (d.id === uid) pos = i + 1; });
                _djQueuePosition = pos;
                if (typeof showToast === 'function') showToast('🎧 Added to DJ queue! Position: #' + pos + '. You\'ll be notified when the booth opens up.');
            });
    }).catch(function(e) {
        if (typeof showToast === 'function') showToast('Failed to join queue: ' + e.message);
    });
}

window.djLeaveQueue = function() {
    if (!auth || !auth.currentUser) return;
    db.collection('global_chat_meta').doc(DJ_DOC).collection(DJ_QUEUE_COL)
        .doc(auth.currentUser.uid).delete().then(function() {
            _djQueuePosition = -1;
            if (typeof showToast === 'function') showToast('Left the DJ queue');
        }).catch(function() {});
};

window.djStopBroadcast = function() {
    if (window._djTrackWatcher) { clearInterval(window._djTrackWatcher); window._djTrackWatcher = null; }
    _djIsMe = false;
    _djSongCount = 0;
    if (typeof db === 'undefined') return;

    // Deactivate booth
    db.collection('global_chat_meta').doc(DJ_DOC).update({ active: false }).then(function() {
        // Notify next person in queue
        db.collection('global_chat_meta').doc(DJ_DOC).collection(DJ_QUEUE_COL)
            .orderBy('joinedAt').limit(1).get().then(function(snap) {
                if (!snap.empty) {
                    var next = snap.docs[0].data();
                    // Post notification in chat
                    db.collection(CHAT_COLLECTION).add({
                        uid: 'system', name: '🎧 DJ Mode',
                        text: '🎤 The DJ booth is open! @' + (next.name || 'Next DJ') + ', you\'re up! Start playing a song and tap 📡 DJ to go live.',
                        ts: firebase.firestore.FieldValue.serverTimestamp()
                    }).catch(function() {});
                }
            }).catch(function() {});
    }).catch(function() {});
    if (typeof showToast === 'function') showToast('🎧 DJ session ended');
    // Remove DJ control panel + queue
    var djPanel = document.getElementById('djControlPanel');
    if (djPanel) djPanel.remove();
    var djPicker = document.getElementById('djTrackPicker');
    if (djPicker) djPicker.remove();
    if (window._djPanelInterval) { clearInterval(window._djPanelInterval); window._djPanelInterval = null; }
    window._djUpNext = [];
    _origBeatsOnEnded = null;
};

// Listeners: tune in to the DJ's stream
window.djTuneIn = function() {
    var npEl = document.getElementById('djNowPlaying');
    if (!npEl) return;
    var url = npEl.getAttribute('data-audio-url');
    var seekTime = parseFloat(npEl.getAttribute('data-playback-time') || '0');
    // For Nacho DJ, calculate position from trackStartedAt
    var startedAt = npEl.getAttribute('data-track-started-at');
    if (startedAt && npEl.getAttribute('data-is-nacho') === 'true') {
        var elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
        if (elapsed > 0) seekTime = elapsed;
    }
    if (!url) { if (typeof showToast === 'function') showToast('No audio available for this track'); return; }
    if (window._beatsAudio && !window._beatsAudio.paused) {
        window._beatsAudio.pause();
        if (typeof showToast === 'function') showToast('⏸ Your player paused — listening to DJ');
    }
    if (_djAudio) { _djAudio.pause(); _djAudio = null; }
    _djAudio = new Audio(url);
    _djAudio.volume = 0.8;
    // Seek to DJ's current position once audio is ready
    _djAudio.addEventListener('loadedmetadata', function() {
        if (seekTime > 0 && seekTime < _djAudio.duration) {
            _djAudio.currentTime = seekTime;
        }
    });
    _djAudio.play().catch(function(e) {
        if (typeof showToast === 'function') showToast('Playback failed: ' + e.message);
    });
    _djListening = true;
    // Seed the SFX timestamp so stale effects from before tune-in don't replay
    window._lastDJSfxTime = Date.now();

    // Track tune-ins for listener badge
    var djListens = parseInt(localStorage.getItem('btc_dj_listens') || '0') + 1;
    localStorage.setItem('btc_dj_listens', djListens);
    if (typeof awardPoints === 'function') awardPoints(3, '🔊 Tuned in to DJ');
    if (djListens === 10 && typeof awardPoints === 'function') awardPoints(15, '🔊 Tuned in to 10 DJ sets!');
    if (djListens === 50 && typeof awardPoints === 'function') awardPoints(50, '🤘 Groupie — 50 tune-ins!');

    var tuneBtn = document.getElementById('djTuneBtn');
    if (tuneBtn) { tuneBtn.textContent = '⏹ Stop'; tuneBtn.onclick = djStopListening; }
};

window.djStopListening = function() {
    if (_djAudio) { _djAudio.pause(); _djAudio = null; }
    _djListening = false;
    var tuneBtn = document.getElementById('djTuneBtn');
    if (tuneBtn) { tuneBtn.textContent = '🔊 Tune In'; tuneBtn.onclick = djTuneIn; }
};

// Listen for DJ state changes + queue notifications
function startDJListener() {
    if (_djUnsub) { _djUnsub(); _djUnsub = null; }
    if (typeof db === 'undefined' || !db) return;
    var myUid = auth && auth.currentUser ? auth.currentUser.uid : null;

    _djUnsub = db.collection('global_chat_meta').doc(DJ_DOC)
        .onSnapshot(function(doc) {
            if (!doc.exists || !doc.data() || !doc.data().active) {
                hideDJBar();
                if (_djAudio) { _djAudio.pause(); _djAudio = null; _djListening = false; }
                // If I'm in the queue, notify me the booth opened
                if (myUid && _djQueuePosition > 0) {
                    db.collection('global_chat_meta').doc(DJ_DOC).collection(DJ_QUEUE_COL)
                        .orderBy('joinedAt').limit(1).get().then(function(snap) {
                            if (!snap.empty && snap.docs[0].id === myUid) {
                                if (typeof showToast === 'function') showToast('🎧🎉 The DJ booth is open and YOU\'RE NEXT! Start playing a song in Beats and tap 📡 DJ to go live!');
                            }
                        }).catch(function() {});
                }
                return;
            }
            var d = doc.data();
            showDJBar(d);
            if (_djListening && _djAudio && d.trackAudioUrl) {
                var currentSrc = _djAudio.src || '';
                if (currentSrc !== d.trackAudioUrl) {
                    // Song changed — crossfade: fade out old, start new at DJ's position
                    var oldAudio = _djAudio;
                    var oldVol = oldAudio.volume;
                    var fadeSteps = 10;
                    var fadeStep = 0;
                    var fadeOut = setInterval(function() {
                        fadeStep++;
                        oldAudio.volume = Math.max(0, oldVol * (1 - fadeStep / fadeSteps));
                        if (fadeStep >= fadeSteps) { clearInterval(fadeOut); oldAudio.pause(); }
                    }, 100);
                    _djAudio = new Audio(d.trackAudioUrl);
                    _djAudio.volume = 0;
                    var _syncTime = d.playbackTime || 0;
                    _djAudio.addEventListener('loadedmetadata', function() {
                        if (_syncTime > 0 && _syncTime < _djAudio.duration) _djAudio.currentTime = _syncTime;
                    });
                    _djAudio.play().then(function() {
                        // Fade in new track
                        var newAudio = _djAudio;
                        var inStep = 0;
                        var fadeIn = setInterval(function() {
                            inStep++;
                            newAudio.volume = Math.min(0.8, 0.8 * (inStep / 10));
                            if (inStep >= 10) clearInterval(fadeIn);
                        }, 100);
                    }).catch(function() {});
                }
            }

            // Periodic drift correction for listeners — nudge if >2s off
            if (_djListening && _djAudio && !_djAudio.paused && d.playbackTime && d.playbackTime > 0) {
                var drift = Math.abs(_djAudio.currentTime - d.playbackTime);
                if (drift > 2 && drift < _djAudio.duration - 5) {
                    _djAudio.currentTime = d.playbackTime;
                }
            }

            // Play SFX from DJ if listener is tuned in
            if (_djListening && d.sfx && d.sfxAt) {
                var sfxTime = d.sfxAt.toDate ? d.sfxAt.toDate().getTime() : 0;
                var now = Date.now();
                // Only play if: newer than last played, less than 10s old (not stale), and cooldown of 1s
                if (sfxTime > (window._lastDJSfxTime || 0) && (now - sfxTime) < 10000 && (now - (window._lastDJSfxPlayedAt || 0)) > 1000) {
                    window._lastDJSfxTime = sfxTime;
                    window._lastDJSfxPlayedAt = now;
                    if (typeof djPlaySFX === 'function') djPlaySFX(d.sfx);
                }
            }
        }, function() { hideDJBar(); });

    // Also listen to queue changes to update our position
    if (_djQueueUnsub) { _djQueueUnsub(); _djQueueUnsub = null; }
    if (myUid) {
        _djQueueUnsub = db.collection('global_chat_meta').doc(DJ_DOC).collection(DJ_QUEUE_COL)
            .orderBy('joinedAt').onSnapshot(function(snap) {
                var pos = 0, found = false;
                snap.forEach(function(d) { pos++; if (d.id === myUid) { _djQueuePosition = pos; found = true; } });
                if (!found) _djQueuePosition = -1;
                // Update queue count on DJ bar
                var qInfo = document.getElementById('djQueueInfo');
                if (qInfo) qInfo.textContent = snap.size > 0 ? snap.size + ' in queue' : '';
            }, function() {});
    }
}

function showDJBar(d) {
    var container = document.getElementById('globalChatMessages');
    if (!container) return;
    var bar = document.getElementById('djNowPlaying');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'djNowPlaying';
        bar.style.cssText = 'position:relative;z-index:5;background:#0a0a0f;border:1px solid rgba(99,102,241,0.3);border-radius:12px;padding:10px 14px;margin-bottom:8px;flex-shrink:0;';
        // Insert before the messages container, not inside it
        var chatPanel = container.parentElement;
        if (chatPanel) chatPanel.insertBefore(bar, container);
        else container.insertBefore(bar, container.firstChild);
    }
    var myUid = auth && auth.currentUser ? auth.currentUser.uid : null;
    var isDJ = d.djUid === myUid;
    var isNacho = d.djUid === 'nacho-dj' || d.isNachoDJ === true;
    var songInfo = (!isNacho && d.songCount) ? ' · Song ' + d.songCount + (d.songCount >= DJ_MAX_SONGS_WITH_QUEUE ? '/5' : '') : '';

    bar.setAttribute('data-audio-url', d.trackAudioUrl || '');
    bar.setAttribute('data-playback-time', d.playbackTime || '0');
    bar.setAttribute('data-is-nacho', isNacho ? 'true' : 'false');
    if (d.trackStartedAt) {
        var tsa = d.trackStartedAt.toDate ? d.trackStartedAt.toDate().toISOString() : (typeof d.trackStartedAt === 'string' ? d.trackStartedAt : '');
        bar.setAttribute('data-track-started-at', tsa);
    }

    // Tip button: removed Tip DJ entirely. DJ name is clickable instead.
    var tipBtn = '';

    // DJ button: if Nacho is playing, let users take over
    var djActionBtn = '';
    if (isDJ) {
        djActionBtn = '<button onclick="djStopBroadcast()" style="padding:6px 10px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;color:#ef4444;font-size:0.7rem;font-weight:700;cursor:pointer;border:none;font-family:inherit;">⏹ Stop DJ</button>';
    } else if (isNacho) {
        djActionBtn = '<button id="djTuneBtn" onclick="' + (_djListening ? 'djStopListening()' : 'djTuneIn()') + '" style="padding:6px 10px;border-radius:8px;font-size:0.7rem;font-weight:700;cursor:pointer;font-family:inherit;' + (_djListening ? 'background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);color:#ef4444;' : 'background:rgba(239,68,68,0.1);border:2px solid #ef4444;color:#ef4444;animation:djPulse 1.5s ease-in-out infinite;') + '">' + (_djListening ? '⏹ Stop' : '🔊 Tune In') + '</button>';
    } else {
        djActionBtn = '<button id="djTuneBtn" onclick="' + (_djListening ? 'djStopListening()' : 'djTuneIn()') + '" style="padding:6px 10px;border-radius:8px;font-size:0.7rem;font-weight:700;cursor:pointer;font-family:inherit;' + (_djListening ? 'background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);color:#ef4444;' : 'background:rgba(239,68,68,0.1);border:2px solid #ef4444;color:#ef4444;animation:djPulse 1.5s ease-in-out infinite;') + '">' + (_djListening ? '⏹ Stop' : '🔊 Tune In') + '</button>';
    }

    var djLabel = isNacho ? '🦌 Nacho Radio — Always On!' : '🎧 <span onclick="if(typeof showUserProfile===\'function\')showUserProfile(\'' + (d.djUid||'') + '\')" style="cursor:pointer;text-decoration:underline;">@' + esc(d.djName) + '</span> is DJing!' + songInfo;

    var artistHtml = d.artistUid ? '<span onclick="if(typeof showUserProfile===\'function\')showUserProfile(\'' + (d.artistUid||'') + '\')" style="cursor:pointer;text-decoration:underline;" title="View Artist Profile">' + esc(d.trackArtist) + '</span>' : esc(d.trackArtist);

    bar.innerHTML =
        // Row 1: DJ label
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">' +
            '<div style="font-size:0.72rem;color:#6366f1;font-weight:700;">' + djLabel + ' <span id="djQueueInfo" style="color:var(--text-faint);font-weight:400;"></span></div>' +
        '</div>' +
        // Row 2: Cover art + track info
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">' +
            (d.trackCoverArt ? '<img src="' + (typeof _safeCover === 'function' ? _safeCover(d.trackCoverArt) : esc(d.trackCoverArt)) + '" style="width:40px;height:40px;border-radius:8px;object-fit:cover;flex-shrink:0;">' : '<div style="width:40px;height:40px;border-radius:8px;background:rgba(99,102,241,0.2);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;">' + (isNacho ? '🦌' : '🎧') + '</div>') +
            '<div style="flex:1;min-width:0;">' +
                '<div style="font-size:0.85rem;color:var(--heading,#fff);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">♫ ' + esc(d.trackTitle) + '</div>' +
                '<div style="font-size:0.72rem;color:var(--text-muted);">' + artistHtml + '</div>' +
            '</div>' +
        '</div>' +
        // Row 3: Action buttons
        '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
            djActionBtn +
            (d.artistUid ? '<button onclick="if(\'' + (d.artistUid||'') + '\'&&typeof showUserProfile===\'function\')showUserProfile(\'' + (d.artistUid||'') + '\')" style="padding:5px 10px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.25);border-radius:8px;color:var(--accent);font-size:0.7rem;font-weight:700;cursor:pointer;font-family:inherit;">⚡ Tip Artist</button>' : '') +
            tipBtn +
            (_djQueuePosition > 0 ? '<button onclick="djLeaveQueue()" style="padding:5px 10px;background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.2);border-radius:8px;color:#ef4444;font-size:0.7rem;cursor:pointer;font-family:inherit;">Leave Queue (#' + _djQueuePosition + ')</button>' : '') +
        '</div>';
}

function hideDJBar() {
    var bar = document.getElementById('djNowPlaying');
    if (bar) { bar.remove(); }
}

// Hook into chat listener to also start DJ listener
var _origStartChatListener = startChatListener;
startChatListener = function() {
    _origStartChatListener();
    startDJListener();
};

// Add "Go Live" button to Beats mini-player
function addDJButton() {
    var mini = document.getElementById('beatsMiniPlayer');
    if (!mini || document.getElementById('djGoLiveBtn')) return;
    var btn = document.createElement('button');
    btn.id = 'djGoLiveBtn';
    btn.textContent = '📡 DJ';
    btn.title = 'Broadcast to Global Chat';
    btn.style.cssText = 'padding:4px 8px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);border-radius:8px;color:#6366f1;font-size:0.65rem;font-weight:700;cursor:pointer;font-family:inherit;margin-left:4px;';
    btn.onclick = function(e) { e.stopPropagation(); djBroadcast(); };
    var controls = mini.querySelector('div') || mini;
    controls.appendChild(btn);
}

var _djBtnObserver = new MutationObserver(function() { addDJButton(); });
if (document.body) _djBtnObserver.observe(document.body, { childList: true, subtree: true });

// Init overlay on load — only show floating button on DESKTOP (mobile uses bottom nav "Chat")
function initOverlay() {
    createChatOverlay();
    // Keep desktopDMBtn visible on desktop — it now triggers toggleChatOverlay
    // var oldBtn = document.getElementById('desktopDMBtn');
    // if (oldBtn) oldBtn.style.display = 'none';
    // Hide floating button on mobile — bottom nav "Chat" is enough
    var chatBtn = document.getElementById('chatOverlayBtn');
    if (chatBtn && window.innerWidth <= 900) chatBtn.style.display = 'none';
    // Safety net: strip chat-shifted from lbFloatBtn if chat panel is not open on init
    if (!_overlayOpen && !document.getElementById('chatContent')) {
        var _lbInit = document.getElementById('lbFloatBtn');
        if (_lbInit) _lbInit.classList.remove('chat-shifted');
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(initOverlay, 2000); });
} else {
    setTimeout(initOverlay, 2000);
}

// ---- Online Users Counter ----
var _presenceInterval = null;

function initPresence() {
    if (_presenceInterval) return;
    if (typeof db === 'undefined' || !db) return;

    // Write presence heartbeat every 60s
    function writePresence() {
        if (!auth || !auth.currentUser) return;
        var uid = auth.currentUser.uid;
        var username = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : null;
        db.collection('presence').doc(uid).set({
            uid: uid,
            name: username || 'Anon',
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(function() {});
    }

    writePresence();
    _presenceInterval = setInterval(writePresence, 60000);

    // Count online users (poll every 2 min instead of real-time listener to save reads)
    function pollPresence() {
        var threeMinAgo = new Date(Date.now() - 180000);
        db.collection('presence')
            .where('lastSeen', '>', threeMinAgo)
            .get().then(function(snap) {
                updateOnlineCount(snap.size);
            }).catch(function() {
                updateOnlineCount(0);
            });
    }
    pollPresence();
    setInterval(pollPresence, 120000);
}

function updateOnlineCount(count) {
    // Update bottom nav Chat label
    var chatLabel = document.querySelector('#bnavMsg .bnav-label');
    if (chatLabel) {
        chatLabel.innerHTML = 'Chat' + (count > 0 ? '<span style="font-size:0.5rem;color:var(--accent);margin-left:2px;">' + count + '</span>' : '');
    }

    // Update desktop overlay button
    var chatBtn = document.getElementById('chatOverlayBtn');
    if (chatBtn) {
        var badge = document.getElementById('chatOnlineBadge');
        if (!badge) {
            badge = document.createElement('span');
            badge.id = 'chatOnlineBadge';
            badge.style.cssText = 'position:absolute;top:-4px;left:-4px;background:#22c55e;color:#fff;font-size:0.5rem;font-weight:800;padding:1px 4px;border-radius:6px;min-width:12px;text-align:center;';
            chatBtn.appendChild(badge);
        }
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }

    // Update chat hub "Global" tab with online count
    var globalTab = document.getElementById('chatTabGlobal');
    if (globalTab) {
        globalTab.innerHTML = '🌍 Global' + (count > 0 ? ' <span style="font-size:0.65rem;color:#22c55e;font-weight:400;">● ' + count + '</span>' : '');
    }
}

// Start presence when auth is ready
if (typeof auth !== 'undefined' && auth) {
    auth.onAuthStateChanged(function(user) {
        if (user) setTimeout(initPresence, 3000);
    });
}

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (auth && auth.currentUser && typeof db !== 'undefined') {
        // Mark as offline by setting lastSeen far in the past
        navigator.sendBeacon && db.collection('presence').doc(auth.currentUser.uid).delete();
    }
});

// ---- Chat Rules Modal ----
window.showChatRules = function() {
    var existing = document.getElementById('chatRulesOverlay');
    if (existing) { existing.remove(); return; }
    var overlay = document.createElement('div');
    overlay.id = 'chatRulesOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10002;display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML =
        '<div style="background:var(--bg-side);border:1px solid var(--border);border-radius:20px;padding:24px;max-width:400px;width:100%;max-height:80vh;overflow-y:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
            '<div style="font-size:1.1rem;font-weight:800;color:var(--heading);">📋 Chat Rules</div>' +
            '<button onclick="document.getElementById(\'chatRulesOverlay\').remove()" style="background:none;border:1px solid var(--border);color:var(--text-muted);width:32px;height:32px;border-radius:8px;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>' +
        '</div>' +
        '<div style="font-size:0.85rem;color:var(--text);line-height:1.8;">' +
            '<div style="margin-bottom:12px;padding:10px;background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.2);border-radius:10px;font-size:0.8rem;color:var(--accent);font-weight:600;">This is a Bitcoin-only community. Be respectful, stay on topic, and help each other learn. 🦌🧡</div>' +
            '1️⃣ <strong>Be respectful.</strong> No personal attacks, harassment, or hate speech.<br><br>' +
            '2️⃣ <strong>Bitcoin only.</strong> No altcoin promotion, shilling, or "what about ETH?" discussions.<br><br>' +
            '3️⃣ <strong>No links.</strong> URLs are automatically blocked to prevent scams and spam.<br><br>' +
            '4️⃣ <strong>No spam, flooding, or self-promotion.</strong> Don\'t repeat messages, use excessive caps, flood the chat, or promote yourself/your business.<br><br>' +
            '5️⃣ <strong>No financial advice.</strong> Share knowledge, not investment tips. Always DYOR.<br><br>' +
            '6️⃣ <strong>No personal info.</strong> Don\'t share or ask for phone numbers, addresses, or real names in public chat.<br><br>' +
            '7️⃣ <strong>No impersonation.</strong> Don\'t pretend to be another user, admin, or Nacho.<br><br>' +
            '8️⃣ <strong>Keep it clean.</strong> Profanity is filtered. Attempts to bypass the filter may result in muting.<br><br>' +
            '9️⃣ <strong>Report issues.</strong> Use the report button if you see rule violations.<br><br>' +
            '🔟 <strong>Have fun!</strong> This is a community of learners. Ask questions, share insights, and stack knowledge together.' +
        '</div>' +
        '<div style="margin-top:16px;padding:10px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;font-size:0.75rem;color:var(--text-faint);text-align:center;">' +
            'Violations may result in message removal or account restrictions.<br>Admins have final say on all moderation decisions.' +
        '</div>' +
        '</div>';
    document.body.appendChild(overlay);
};

// ---- Unread Message Counter for Chat Button ----
var _unreadChatCount = 0;
var _lastSeenChatTs = parseInt(localStorage.getItem('btc_chat_last_seen') || '0');
var _bgChatUnsub = null;

function startUnreadTracker() {
    if (_bgChatUnsub || typeof db === 'undefined' || !db) return;
    _bgChatUnsub = db.collection(CHAT_COLLECTION)
        .orderBy('ts', 'desc')
        .limit(10)
        .onSnapshot(function(snapshot) {
            var count = 0;
            snapshot.forEach(function(doc) {
                var d = doc.data();
                if (d.ts) {
                    var msgTs = d.ts.seconds ? d.ts.seconds * 1000 : (d.ts.toMillis ? d.ts.toMillis() : 0);
                    if (msgTs > _lastSeenChatTs) count++;
                }
            });
            _unreadChatCount = count;
            updateChatUnreadBadge();
        }, function() {});
}

window.markChatAsRead = function() {
    _lastSeenChatTs = Date.now();
    _unreadChatCount = 0;
    localStorage.setItem('btc_chat_last_seen', String(_lastSeenChatTs));
    updateChatUnreadBadge();
};

function updateChatUnreadBadge() {
    // Desktop Chat button
    var deskBtn = document.getElementById('desktopDMBtn');
    if (deskBtn) {
        var badge = document.getElementById('chatUnreadBadge');
        if (!badge) {
            badge = document.createElement('span');
            badge.id = 'chatUnreadBadge';
            badge.style.cssText = 'position:absolute;top:-6px;right:-6px;background:#ef4444;color:#fff;font-size:0.55rem;font-weight:800;padding:2px 5px;border-radius:8px;min-width:14px;text-align:center;display:none;';
            // Don't override position — desktopDMBtn is position:fixed
            deskBtn.appendChild(badge);
        }
        if (_unreadChatCount > 0) {
            badge.textContent = _unreadChatCount > 99 ? '99+' : _unreadChatCount;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }
    // Mobile bottom nav Chat/DM button
    var mobileBtn = document.getElementById('bnavNotif');
    if (!mobileBtn) mobileBtn = document.querySelector('#bottomNav [onclick*="toggleNotifOverlay"]');
    // Actually target the DM/chat button in bottom nav
    var mobileChatBtn = document.querySelector('#bottomNav [onclick*="toggleChatOverlay"], #bottomNav [onclick*="showInbox"]');
    // Update bottom nav badge if we have a dedicated chat btn
    var bnavMsg = document.getElementById('bnavMsg');
    if (bnavMsg) {
        var mBadge = document.getElementById('bnavChatUnread');
        if (!mBadge) {
            mBadge = document.createElement('span');
            mBadge.id = 'bnavChatUnread';
            mBadge.style.cssText = 'position:absolute;top:2px;right:4px;background:#ef4444;color:#fff;font-size:0.5rem;font-weight:800;padding:1px 4px;border-radius:6px;min-width:12px;text-align:center;display:none;';
            bnavMsg.style.position = 'relative';
            bnavMsg.appendChild(mBadge);
        }
        if (_unreadChatCount > 0) {
            mBadge.textContent = _unreadChatCount > 99 ? '99+' : _unreadChatCount;
            mBadge.style.display = 'block';
        } else {
            mBadge.style.display = 'none';
        }
    }
}

// Mark as read when user opens chat
var _origRenderChatHub3 = window.renderChatHub;
if (_origRenderChatHub3) {
    window.renderChatHub = function(tab) {
        _origRenderChatHub3(tab);
        if (tab === 'global') markChatAsRead();
    };
}
var _origToggleChatOverlay = window.toggleChatOverlay;
if (_origToggleChatOverlay) {
    window.toggleChatOverlay = function() {
        _origToggleChatOverlay();
        markChatAsRead();
    };
}

// Only start unread tracker if user has previously opened chat (saves Firestore reads)
// The tracker will auto-start on first chat open instead
if (localStorage.getItem('hasUsedChat')) {
    setTimeout(function() {
        if (typeof db !== 'undefined' && db) startUnreadTracker();
        else setTimeout(function() { if (typeof db !== 'undefined' && db) startUnreadTracker(); }, 5000);
    }, 10000); // Delay 10s to let more critical loads go first
}

// ---- Lookup User by Username (for clickable @mentions) ----
window.lookupUserByName = function(username) {
    if (!username) return;
    if (typeof db === 'undefined' || !db) {
        if (typeof showToast === 'function') showToast('Loading...');
        return;
    }
    // First check the in-memory chat user cache (uid → name)
    if (typeof _chatUsers !== 'undefined') {
        for (var uid in _chatUsers) {
            if (_chatUsers[uid] === username || _chatUsers[uid].toLowerCase() === username.toLowerCase()) {
                if (typeof showUserProfile === 'function') showUserProfile(uid);
                return;
            }
        }
    }
    // Fallback: query Firestore by username field
    db.collection('users').where('username', '==', username).limit(1).get()
        .then(function(snap) {
            if (!snap.empty) {
                var uid = snap.docs[0].id;
                if (typeof showUserProfile === 'function') showUserProfile(uid);
            } else {
                // Try case-insensitive (username_lower)
                db.collection('users').where('username_lower', '==', username.toLowerCase()).limit(1).get()
                    .then(function(snap2) {
                        if (!snap2.empty) {
                            if (typeof showUserProfile === 'function') showUserProfile(snap2.docs[0].id);
                        } else {
                            if (typeof showToast === 'function') showToast('User @' + username + ' not found');
                        }
                    }).catch(function() {
                        if (typeof showToast === 'function') showToast('User @' + username + ' not found');
                    });
            }
        }).catch(function() {
            if (typeof showToast === 'function') showToast('Could not look up user');
        });
};

// ---- Announcement link navigation helper ----
// Closes whichever chat surface is open, then routes to the hash.
window._annNavToHash = function(hash) {
    var wasOverlayOpen = !!window._chatOverlayOpen;
    // Close overlay if open
    if (wasOverlayOpen && typeof toggleChatOverlay === 'function') toggleChatOverlay();
    var delay = wasOverlayOpen ? 320 : 0;
    setTimeout(function() {
        // Map hash → proper navigation action
        // showQuestHub / showUserProfile etc. are overlays that work on top of any view
        // but channel routes (forum, marketplace, beats…) need go() so forumContainer is hidden first
        var overlayRoutes = { 'quests':1, 'favor':1, 'sf':1, 'satoshi-favor':1, 'pvp':1, 'nacho':1,
                             'dashboard':1, 'bitcoin-dashboard':1, 'metrics':1, 'network':1,
                             'pow-support':1 };
        if (overlayRoutes[hash]) {
            // These open on top of whatever view is current — fine for both surfaces
            if (hash === 'quests' && typeof showQuestHub === 'function') { showQuestHub(); return; }
            if ((hash === 'favor' || hash === 'sf' || hash === 'satoshi-favor') && typeof showQuestHub === 'function') {
                showQuestHub(); window._questHubTab = 'favor';
                setTimeout(function() { if (typeof _renderQuestHubTab === 'function') _renderQuestHubTab(); }, 50);
                return;
            }
        }
        // For channel routes (and full chat panel): call go() which properly hides forumContainer
        if (typeof go === 'function') {
            // Map common aliases
            var id = hash === 'tv' ? 'timechain-tv' : hash === 'meet' ? 'irl-sync' :
                     hash === 'buy' || hash === 'first-purchase' ? 'first-purchase' :
                     hash === 'learn' || hash === 'modules' ? 'trails' : hash;
            go(id);
        } else {
            // Fallback: change hash to fire existing router
            window.location.hash = hash;
        }
    }, delay);
};

// ---- Shared reaction-bar builder — used by renderer + optimistic updater ----
function _buildAnnReactBar(docId, reactions, myUid, esc) {
    esc = esc || (typeof escapeHtml === 'function' ? escapeHtml : function(s){return String(s);});
    var html = '<div data-react-bar style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap;align-items:center;">';
    Object.keys(reactions).forEach(function(emoji) {
        var uids = reactions[emoji] || [];
        if (!uids.length) return;
        var reacted = myUid && uids.indexOf(myUid) !== -1;
        html += '<button onclick="event.stopPropagation();_toggleAnnouncementReaction(\''+esc(docId)+'\',\''+emoji+'\')" style="padding:3px 8px;border-radius:20px;border:1px solid '+(reacted?'var(--accent)':'var(--border)')+';background:'+(reacted?'rgba(247,147,26,0.12)':'var(--card-bg)')+';font-size:0.75rem;cursor:pointer;color:var(--text);display:flex;align-items:center;gap:3px;">'+emoji+'<span style="font-size:0.65rem;color:var(--text-muted);">'+uids.length+'</span></button>';
    });
    html += '<button onclick="event.stopPropagation();_showAnnReactPicker(this,\''+esc(docId)+'\')" style="padding:3px 7px;border-radius:20px;border:1px solid var(--border);background:var(--card-bg);font-size:0.75rem;cursor:pointer;color:var(--text-faint);">➕</button>';
    html += '</div>';
    return html;
}

// ---- Shared Announcement Item Renderer ----
// context: 'panel' = full chat hub, 'overlay' = floating overlay
function _renderAnnouncementItem(doc, context) {
    var m = doc.data ? doc.data() : doc;
    var docId = doc.id || '';
    var esc = typeof escapeHtml === 'function' ? escapeHtml : function(s) { return String(s).replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
    var timeStr = '';
    if (m.ts && m.ts.toDate) { try { timeStr = typeof timeAgo === 'function' ? timeAgo(m.ts) : ''; } catch(e) {} }

    // Process text: escape first, then linkify in order
    var text = esc(m.text || '');

    // 1. [text](#hash) markdown links — use _annNavToHash which closes chat then routes
    text = text.replace(/\[([^\]]+)\]\(#([^)]+)\)/g, function(_, label, hash) {
        return '<a href="#' + hash + '" onclick="event.preventDefault();event.stopPropagation();if(typeof _annNavToHash===\'function\')_annNavToHash(\''+hash+'\')" style="color:var(--accent);font-weight:700;text-decoration:underline;cursor:pointer;">'+label+'</a>';
    });

    // 2. @username mentions — link to user profile using stored mentionUid
    var mentionUid = m.mentionUid || '';
    text = text.replace(/@([A-Za-z0-9_]+)/g, function(_, username) {
        if (mentionUid) {
            return '<a onclick="event.preventDefault();event.stopPropagation();if(typeof showUserProfile===\'function\')showUserProfile(\''+esc(mentionUid)+'\')" style="color:#6366f1;font-weight:700;cursor:pointer;text-decoration:none;">@'+username+'</a>';
        }
        return '<span style="color:#6366f1;font-weight:700;">@'+username+'</span>';
    });

    var isOverlay = context === 'overlay';
    var pad = isOverlay ? '10px 12px' : '12px 14px';
    var fontSize = isOverlay ? '0.78rem' : '0.82rem';
    var avatarSize = isOverlay ? '1.2rem' : '1.6rem';
    var borderR = isOverlay ? '12px' : '14px';

    // Emoji reactions — show existing counts + a ➕ button to open the full picker
    var reactions = m.reactions || {};
    var myUid = (typeof auth !== 'undefined' && auth && auth.currentUser) ? auth.currentUser.uid : null;
    var reactHtml = _buildAnnReactBar(docId, m.reactions || {}, myUid, esc);

    return '<div data-ann-id="'+esc(docId)+'" style="display:flex;gap:10px;align-items:flex-start;padding:'+pad+';background:rgba(34,197,94,0.04);border:1px solid rgba(34,197,94,0.15);border-radius:'+borderR+';">' +
        '<div style="font-size:'+avatarSize+';flex-shrink:0;line-height:1;padding-top:2px;">🦌</div>' +
        '<div style="flex:1;min-width:0;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
                '<span style="font-size:0.75rem;font-weight:700;color:#22c55e;">🦌 Nacho</span>' +
                (timeStr ? '<span style="font-size:0.65rem;color:var(--text-faint);">'+esc(timeStr)+'</span>' : '') +
            '</div>' +
            '<div style="font-size:'+fontSize+';color:var(--text);line-height:1.5;word-break:break-word;">'+text+'</div>' +
            reactHtml +
        '</div>' +
    '</div>';
}

// Toggle emoji reaction on an announcement doc
window._toggleAnnouncementReaction = function(docId, emoji) {
    if (!docId || typeof db === 'undefined' || !db) return;
    var myUid = (typeof auth !== 'undefined' && auth && auth.currentUser) ? auth.currentUser.uid : null;
    if (!myUid) { if (typeof showToast === 'function') showToast('Sign in to react'); return; }
    var esc = typeof escapeHtml === 'function' ? escapeHtml : function(s){return String(s);};
    var ref = db.collection(ANNOUNCEMENTS_COLLECTION).doc(docId);
    ref.get().then(function(snap) {
        if (!snap.exists) return;
        var reactions = snap.data().reactions || {};
        var current = reactions[emoji] || [];
        var already = current.indexOf(myUid) !== -1;
        // Optimistic local patch — build new reactions map in memory, update DOM immediately
        var patched = {};
        Object.keys(reactions).forEach(function(k) { patched[k] = reactions[k].slice(); });
        if (!patched[emoji]) patched[emoji] = [];
        if (already) {
            patched[emoji] = patched[emoji].filter(function(u) { return u !== myUid; });
        } else {
            patched[emoji] = patched[emoji].concat([myUid]);
        }
        function _applyReactBar(r) {
            var newBar = _buildAnnReactBar(docId, r, myUid, esc);
            document.querySelectorAll('[data-ann-id="' + esc(docId) + '"]').forEach(function(el) {
                var bar = el.querySelector('[data-react-bar]');
                if (bar) {
                    var tmp = document.createElement('div');
                    tmp.innerHTML = newBar;
                    bar.replaceWith(tmp.firstChild);
                }
            });
        }
        _applyReactBar(patched);
        // Fire Firestore write in background; revert if it fails
        var update = {};
        update['reactions.' + emoji] = already
            ? firebase.firestore.FieldValue.arrayRemove(myUid)
            : firebase.firestore.FieldValue.arrayUnion(myUid);
        ref.update(update).catch(function() { _applyReactBar(reactions); });
    }).catch(function() {});
};

// Full emoji picker for announcement reactions — same categories as global chat
window._showAnnReactPicker = function(btnEl, docId) {
    var old = document.getElementById('annReactPicker');
    if (old) { old.remove(); return; }
    var picker = document.createElement('div');
    picker.id = 'annReactPicker';
    var _isDark = document.body.getAttribute('data-theme') !== 'light';
    // Solid background — never transparent
    var bg = _isDark ? '#1a1a2e' : '#f0f0f5';
    picker.style.cssText = 'position:fixed;z-index:260000;background:'+bg+';border:1px solid var(--border);border-radius:16px;padding:10px;width:280px;max-height:300px;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.6);';

    var cats = Object.keys(EMOJI_CATEGORIES);
    var tabHtml = '<div style="display:flex;gap:2px;margin-bottom:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;">';
    cats.forEach(function(cat, i) {
        var icon = cat === 'Smileys' ? '😀' : cat === 'Gestures' ? '👍' : cat === 'Bitcoin' ? '₿' : '🔥';
        tabHtml += '<button onclick="window._switchAnnEmojiTab(\''+cat+'\')" id="annEmojiTab_'+i+'" style="padding:5px 8px;font-size:0.9rem;cursor:pointer;background:'+(i===0?'var(--accent-bg)':'none')+';border:1px solid '+(i===0?'var(--accent)':'var(--border)')+';border-radius:8px;flex-shrink:0;touch-action:manipulation;" title="'+cat+'">'+icon+'</button>';
    });
    tabHtml += '<button onclick="document.getElementById(\'annReactPicker\').remove()" style="margin-left:auto;padding:4px 7px;background:none;border:none;color:var(--text-faint);font-size:0.9rem;cursor:pointer;flex-shrink:0;">✕</button></div>';
    picker.innerHTML = tabHtml + '<div id="annEmojiGrid" style="display:flex;flex-wrap:wrap;gap:1px;overflow-y:auto;max-height:220px;justify-content:center;"></div>';

    // Position above the button
    document.body.appendChild(picker);
    var rect = btnEl.getBoundingClientRect();
    var top = rect.top - picker.offsetHeight - 8;
    if (top < 8) top = rect.bottom + 8;
    picker.style.top = top + 'px';
    picker.style.left = Math.max(8, Math.min(rect.left - 100, window.innerWidth - 296)) + 'px';

    window._switchAnnEmojiTab = function(cat) {
        var grid = document.getElementById('annEmojiGrid');
        if (!grid) return;
        var emojis = EMOJI_CATEGORIES[cat] || [];
        var html = '';
        emojis.forEach(function(e) {
            html += '<button onclick="document.getElementById(\'annReactPicker\').remove();_toggleAnnouncementReaction(\''+docId+'\',\''+e+'\')" style="padding:5px;font-size:1.2rem;cursor:pointer;background:none;border:none;border-radius:6px;touch-action:manipulation;line-height:1;" onmouseover="this.style.background=\'rgba(255,255,255,0.12)\'" onmouseout="this.style.background=\'none\'">'+e+'</button>';
        });
        grid.innerHTML = html;
        var catKeys = Object.keys(EMOJI_CATEGORIES);
        catKeys.forEach(function(c, i) {
            var t = document.getElementById('annEmojiTab_'+i);
            if (t) { t.style.background = c===cat?'var(--accent-bg)':'none'; t.style.borderColor = c===cat?'var(--accent)':'var(--border)'; }
        });
    };
    window._switchAnnEmojiTab(cats[0]);

    setTimeout(function() {
        document.addEventListener('click', function _dismiss(e) {
            var p = document.getElementById('annReactPicker');
            if (p && !p.contains(e.target)) { p.remove(); document.removeEventListener('click', _dismiss); }
        });
    }, 50);
};

// ---- Nacho Global Announcements (callable from other modules) ----
// Announcements go to the ANNOUNCEMENTS_COLLECTION (separate from global chat)
// so they don\'t spam the conversation.
window.nachoGlobalAnnounce = function(text, mentionUid) {
    if (!text || typeof db === 'undefined' || !db) return;
    var uid = (typeof auth !== 'undefined' && auth && auth.currentUser) ? auth.currentUser.uid : 'nacho-bot';
    // Rate limit: max 1 announcement per 30s per unique message.
    // Key uses 100 chars so different badge names / point counts don't collide.
    var now = Date.now();
    var key = '_nachoAnnounce_' + text.substring(0, 100);
    if (window[key] && now - window[key] < 30000) return;
    window[key] = now;
    var msgData = {
        uid: uid,
        name: '\uD83E\uDD8C Nacho',
        text: text,
        isNachoAuto: true,
        ts: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (mentionUid) msgData.mentionUid = mentionUid;
    // Write to announcements collection (keeps global chat human-only)
    db.collection(ANNOUNCEMENTS_COLLECTION).add(msgData).catch(function(e) {
        console.error('[CHAT] Nacho announce failed:', e);
    });
    // Still bridge to Telegram for visibility
    bridgeToTelegram({ user: '\uD83E\uDD8C Nacho', text: text });
};

console.log('[CHAT] Global chat module loaded');
}();
