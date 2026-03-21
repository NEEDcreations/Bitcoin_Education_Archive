// =============================================
// 💬 Global Chat — Real-time chatroom for all users
// =============================================
!function() {
'use strict';

var CHAT_COLLECTION = 'global_chat';
var MAX_MSG_LENGTH = 300;
var RATE_LIMIT_MS = 3000; // 3 seconds between messages
var MAX_MSGS_DISPLAY = 100;
var _chatUnsub = null;
var _lastSendTime = 0;
var _chatTab = 'global'; // 'global' or 'dms'
var _replyTo = null; // {_id, name, text} when replying
var _acType = null; // 'hash' or 'at' for autocomplete
var _acQuery = ''; // current autocomplete search
var _acStart = 0; // cursor position where trigger started
var _chatUsers = {}; // uid -> username cache from messages
var _acIndex = 0; // keyboard nav index

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
var BAD_WORDS = ['fuck','shit','bitch','dick','cock','pussy','cunt','nigger','nigga','fag','retard','nazi','hitler','kkk','porn','hentai','rape','pedo','kill yourself','kys'];
function containsProfanity(text) {
    var lower = text.toLowerCase().replace(/[0-9@$!*_\-]/g, function(c) {
        return {'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','@':'a','$':'s','!':'i','*':''}[c] || c;
    });
    for (var i = 0; i < BAD_WORDS.length; i++) {
        if (lower.includes(BAD_WORDS[i])) return true;
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

    var html = '<div style="max-width:600px;margin:0 auto;padding:0;height:calc(100vh - 120px);display:flex;flex-direction:column;">';

    // Tab bar
    html += '<div style="display:flex;border-bottom:1px solid var(--border);flex-shrink:0;background:var(--bg-side);">';
    html += '<button id="chatTabGlobal" onclick="switchChatTab(\'global\')" style="flex:1;padding:14px 0;background:none;border:none;border-bottom:2px solid ' + (_chatTab === 'global' ? 'var(--accent)' : 'transparent') + ';color:' + (_chatTab === 'global' ? 'var(--accent)' : 'var(--text-muted)') + ';font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">🌍 Global Chat</button>';
    html += '<button id="chatTabDMs" onclick="switchChatTab(\'dms\')" style="flex:1;padding:14px 0;background:none;border:none;border-bottom:2px solid ' + (_chatTab === 'dms' ? 'var(--accent)' : 'transparent') + ';color:' + (_chatTab === 'dms' ? 'var(--accent)' : 'var(--text-muted)') + ';font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">✉️ Direct Messages</button>';
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

    // Update tab styles
    var gTab = document.getElementById('chatTabGlobal');
    var dTab = document.getElementById('chatTabDMs');
    if (gTab) {
        gTab.style.borderBottomColor = tab === 'global' ? 'var(--accent)' : 'transparent';
        gTab.style.color = tab === 'global' ? 'var(--accent)' : 'var(--text-muted)';
    }
    if (dTab) {
        dTab.style.borderBottomColor = tab === 'dms' ? 'var(--accent)' : 'transparent';
        dTab.style.color = tab === 'dms' ? 'var(--accent)' : 'var(--text-muted)';
    }

    // Unsubscribe from global chat listener when switching away
    if (tab !== 'global' && _chatUnsub) {
        _chatUnsub();
        _chatUnsub = null;
    }

    if (tab === 'global') {
        renderGlobalChat();
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
        '<div id="globalChatMessages" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 16px;display:flex;flex-direction:column;gap:6px;">' +
            '<div style="text-align:center;padding:20px;color:var(--text-faint);font-size:0.75rem;">Loading chat...</div>' +
        '</div>' +
        '<div style="flex-shrink:0;padding:10px 16px;border-top:1px solid var(--border);background:var(--bg-side);">' +
            (hasUsername ?
                '<div id="chatReplyBanner" style="display:none;padding:6px 12px;background:rgba(99,102,241,0.1);border-left:3px solid #6366f1;border-radius:6px;margin-bottom:6px;font-size:0.75rem;color:var(--text-muted);position:relative;">Replying to <strong id="chatReplyName"></strong>: <span id="chatReplyPreview"></span><span onclick="cancelReply()" style="position:absolute;right:8px;top:4px;cursor:pointer;font-size:0.9rem;color:var(--text-faint);">✕</span></div>' +
                '<div style="position:relative;">' +
                    '<div id="chatAutocomplete" style="display:none;position:absolute;bottom:100%;left:0;right:0;max-height:180px;overflow-y:auto;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;margin-bottom:4px;box-shadow:0 -4px 16px rgba(0,0,0,0.3);z-index:10;"></div>' +
                    '<div style="display:flex;gap:8px;align-items:center;">' +
                        '<input type="text" id="globalChatInput" placeholder="Say something... (# for channels, @ for users)" maxlength="' + MAX_MSG_LENGTH + '" style="flex:1;padding:12px 16px;background:var(--input-bg);border:1px solid var(--border);border-radius:20px;color:var(--text);font-size:0.88rem;font-family:inherit;outline:none;box-sizing:border-box;" autocomplete="off">' +
                        '<button onclick="sendGlobalChat()" style="padding:10px 16px;background:var(--accent);color:#fff;border:none;border-radius:20px;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;flex-shrink:0;touch-action:manipulation;">Send</button>' +
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

    // Input handling: character counter + autocomplete
    var input = document.getElementById('globalChatInput');
    if (input) {
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
        if (el) el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-faint);font-size:0.8rem;">Chat unavailable — reconnecting...</div>';
        return;
    }

    _chatUnsub = db.collection(CHAT_COLLECTION)
        .orderBy('ts', 'desc')
        .limit(MAX_MSGS_DISPLAY)
        .onSnapshot(function(snapshot) {
            var msgs = [];
            snapshot.forEach(function(doc) {
                var d = doc.data();
                d._id = doc.id;
                msgs.push(d);
            });
            msgs.reverse(); // oldest first
            renderChatMessages(msgs);
        }, function(err) {
            console.error('[CHAT] Listener error:', err);
            var el = document.getElementById('globalChatMessages');
            if (el) el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-faint);font-size:0.8rem;">Chat connection lost. Refresh to retry.</div>';
        });
}

function renderChatMessages(msgs) {
    var el = document.getElementById('globalChatMessages');
    if (!el) return;

    var myUid = (typeof auth !== 'undefined' && auth && auth.currentUser) ? auth.currentUser.uid : null;
    var isAdmin = myUid && typeof auth !== 'undefined' && auth.currentUser && auth.currentUser.email === 'needcreations@gmail.com';
    var wasAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;

    if (msgs.length === 0) {
        el.innerHTML = '<div style="text-align:center;padding:40px 20px;"><div style="font-size:2rem;margin-bottom:8px;">🌍</div><div style="color:var(--text-muted);font-size:0.85rem;">No messages yet. Be the first to say something!</div></div>';
        return;
    }

    // Cache usernames for @mention autocomplete
    for (var u = 0; u < msgs.length; u++) {
        if (msgs[u].uid && msgs[u].name && msgs[u].uid !== 'nacho-bot') {
            _chatUsers[msgs[u].uid] = msgs[u].name;
        }
    }

    var html = '';
    var lastDate = '';
    for (var i = 0; i < msgs.length; i++) {
        var m = msgs[i];
        var isMe = m.uid === myUid;
        var dateStr = m.ts ? (m.ts.toDate ? m.ts.toDate() : new Date(m.ts)).toLocaleDateString() : '';

        if (dateStr !== lastDate) {
            html += '<div style="text-align:center;margin:8px 0;"><span style="background:var(--card-bg);border:1px solid var(--border);padding:3px 10px;border-radius:10px;font-size:0.65rem;color:var(--text-faint);">' + dateStr + '</span></div>';
            lastDate = dateStr;
        }

        var nameColor = isMe ? 'var(--accent)' : '#6366f1';
        var bubbleBg = isMe ? 'var(--accent-bg,rgba(247,147,26,0.08))' : 'var(--card-bg)';
        var bubbleBorder = isMe ? 'rgba(247,147,26,0.2)' : 'var(--border)';
        var align = isMe ? 'flex-end' : 'flex-start';

        html += '<div style="display:flex;flex-direction:column;align-items:' + align + ';max-width:85%;">';
        html += '<div style="background:' + bubbleBg + ';border:1px solid ' + bubbleBorder + ';border-radius:' + (isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px') + ';padding:8px 12px;position:relative;">';
        html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">';
        html += '<span style="font-weight:700;font-size:0.75rem;color:' + nameColor + ';cursor:pointer;" onclick="if(typeof showUserProfile===\'function\')showUserProfile(\'' + (m.uid || '') + '\')">' + esc(m.name || 'Anon') + '</span>';
        html += '<span style="font-size:0.6rem;color:var(--text-faint);">' + timeAgo(m.ts) + '</span>';
        // Reply button (for all logged-in users)
        if (myUid) {
            html += '<span onclick="setChatReply(\'' + m._id + '\',\'' + esc(m.name || 'Anon').replace(/'/g,'\\&#39;') + '\',\'' + esc((m.text||'').substring(0,50)).replace(/'/g,'\\&#39;') + '\')" style="cursor:pointer;font-size:0.6rem;color:var(--text-faint);margin-left:auto;opacity:0.5;transition:0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.5" title="Reply">↩️</span>';
        }
        // Delete: own messages OR admin can delete anyone's
        if (isMe || isAdmin) {
            html += '<span onclick="deleteChatMsg(\'' + m._id + '\')" style="cursor:pointer;font-size:0.6rem;color:#ef4444;margin-left:4px;opacity:0.5;transition:0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.5" title="Delete">🗑️</span>';
        }
        html += '</div>';
        // Show reply quote if this message is a reply
        if (m.replyToName) {
            html += '<div style="padding:4px 8px;margin-bottom:4px;border-left:2px solid #6366f1;font-size:0.7rem;color:var(--text-faint);border-radius:2px;background:rgba(99,102,241,0.05);">';
            html += '<span style="font-weight:700;">' + esc(m.replyToName) + '</span>: ' + esc((m.replyToText||'').substring(0,60)) + (m.replyToText && m.replyToText.length > 60 ? '…' : '');
            html += '</div>';
        }
        html += '<div style="color:var(--text);font-size:0.85rem;line-height:1.5;word-break:break-word;">' + formatChatText(esc(m.text || '')) + '</div>';
        html += '</div></div>';
    }

    el.innerHTML = html;

    // Auto-scroll to bottom if user was near bottom
    if (wasAtBottom) {
        el.scrollTop = el.scrollHeight;
    }
}

// Format chat text: links, #channels, @mentions
function formatChatText(text) {
    // URLs
    text = text.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:var(--accent);word-break:break-all;">$1</a>');
    // #channel tags → clickable links
    text = text.replace(/#([a-zA-Z0-9_-]+)/g, function(match, tag) {
        return '<a href="#' + tag + '" onclick="event.preventDefault();if(typeof go===\'function\')go(\'' + tag + '\');" style="color:#6366f1;font-weight:700;text-decoration:none;cursor:pointer;">' + match + '</a>';
    });
    // @mentions → styled
    text = text.replace(/@([a-zA-Z0-9_]+)/g, '<span style="color:#6366f1;font-weight:700;">@$1</span>');
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

// ---- Send Message ----
window.sendGlobalChat = function() {
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

    // Profanity check
    if (containsProfanity(text)) {
        if (typeof showToast === 'function') showToast('🚫 Message contains inappropriate language.');
        return;
    }

    // Spam check
    if (isSpammy(text)) {
        if (typeof showToast === 'function') showToast('🚫 Message flagged as spam. Please write normally.');
        return;
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

    // Clear reply banner
    var replyData = {};
    if (_replyTo) {
        replyData = {replyTo: _replyTo._id, replyToName: _replyTo.name, replyToText: _replyTo.text};
        _replyTo = null;
        var banner = document.getElementById('chatReplyBanner');
        if (banner) banner.style.display = 'none';
    }

    // Write to Firestore
    var msgData = {uid: uid, name: username, text: text, ts: firebase.firestore.FieldValue.serverTimestamp()};
    if (replyData.replyTo) { msgData.replyTo = replyData.replyTo; msgData.replyToName = replyData.replyToName; msgData.replyToText = replyData.replyToText; }
    db.collection(CHAT_COLLECTION).add(msgData).catch(function(err) {
        console.error('[CHAT] Send error:', err);
        if (typeof showToast === 'function') showToast('Failed to send: ' + (err.message || 'Unknown error'));
    });

    // Award points for first chat message of the day
    var chatDay = 'btc_chat_day_' + new Date().toDateString();
    if (!localStorage.getItem(chatDay)) {
        localStorage.setItem(chatDay, '1');
        if (typeof awardPoints === 'function') awardPoints(5, '💬 Global Chat');
    }

    // Nacho auto-answer: any question (contains ?) gets passed to nachoUnifiedAnswer
    if (text.includes('?') && typeof nachoUnifiedAnswer === 'function') {
        nachoUnifiedAnswer(text, function(result) {
            if (!result || !result.answer) return;
            // Skip fallback / "I don't know" answers
            if (result.type === 'fallback') return;
            var answer = result.answer.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim();
            if (!answer || answer.length < 10) return;
            // Truncate for chat
            if (answer.length > MAX_MSG_LENGTH) answer = answer.substring(0, MAX_MSG_LENGTH - 3) + '...';
            setTimeout(function() {
                db.collection(CHAT_COLLECTION).add({
                    uid: 'nacho-bot',
                    name: '🦌 Nacho',
                    text: answer,
                    ts: firebase.firestore.FieldValue.serverTimestamp()
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

    // Floating chat button (bottom-right, above bottom nav)
    var btn = document.createElement('button');
    btn.id = 'chatOverlayBtn';
    btn.innerHTML = '💬';
    btn.title = 'Open Chat';
    btn.style.cssText = 'position:fixed;bottom:80px;right:16px;z-index:300;width:52px;height:52px;border-radius:50%;background:var(--accent,#f7931a);color:#fff;border:none;font-size:1.5rem;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.4);transition:transform 0.2s,opacity 0.2s;touch-action:manipulation;-webkit-tap-highlight-color:transparent;';
    btn.onclick = toggleChatOverlay;
    // Start visible on all screen sizes

    // Overlay panel
    var panel = document.createElement('div');
    panel.id = 'chatOverlay';
    panel.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:299;height:65vh;max-height:500px;background:var(--bg,#0a0a0f);border-top:2px solid var(--accent,#f7931a);border-radius:16px 16px 0 0;transform:translateY(100%);transition:transform 0.3s cubic-bezier(0.22,1,0.36,1);display:flex;flex-direction:column;box-shadow:0 -8px 32px rgba(0,0,0,0.5);';

    // Header bar with drag handle
    var header = document.createElement('div');
    header.style.cssText = 'flex-shrink:0;padding:8px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);';
    header.innerHTML = '<div style="width:40px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 4px;"></div>';
    header.innerHTML += '<div style="display:flex;width:100%;align-items:center;justify-content:space-between;"><span style="font-weight:700;font-size:0.85rem;color:var(--heading,#fff);">🌍 Global Chat</span><button onclick="toggleChatOverlay()" style="background:none;border:none;color:var(--text-faint);font-size:1.2rem;cursor:pointer;padding:4px 8px;">✕</button></div>';

    // Chat content container
    var body = document.createElement('div');
    body.id = 'chatOverlayBody';
    body.style.cssText = 'flex:1;overflow:hidden;display:flex;flex-direction:column;';

    panel.appendChild(header);
    panel.appendChild(body);
    document.body.appendChild(panel);
    document.body.appendChild(btn);

    // Unread badge on the button
    var badge = document.createElement('span');
    badge.id = 'chatOverlayBadge';
    badge.style.cssText = 'display:none;position:absolute;top:-2px;right:-2px;background:#ef4444;color:#fff;font-size:0.6rem;font-weight:800;padding:2px 5px;border-radius:8px;min-width:14px;text-align:center;';
    btn.style.position = 'fixed'; // ensure btn is positioned
    btn.appendChild(badge);

    // Style for desktop
    var style = document.createElement('style');
    style.textContent = '@media(min-width:901px){#chatOverlay{max-width:400px;right:16px;left:auto;border-radius:16px 16px 0 0;}#chatOverlayBtn{bottom:20px;right:20px;}}';
    document.head.appendChild(style);
}

window.toggleChatOverlay = function() {
    var panel = document.getElementById('chatOverlay');
    var btn = document.getElementById('chatOverlayBtn');
    if (!panel) return;

    _overlayOpen = !_overlayOpen;
    panel.style.transform = _overlayOpen ? 'translateY(0)' : 'translateY(100%)';

    if (btn) {
        btn.innerHTML = _overlayOpen ? '✕' : '💬';
        btn.style.background = _overlayOpen ? 'var(--card-bg)' : 'var(--accent,#f7931a)';
        btn.style.color = _overlayOpen ? 'var(--text-faint)' : '#fff';
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

function renderOverlayChat() {
    var body = document.getElementById('chatOverlayBody');
    if (!body) return;

    var isSignedIn = typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous;
    var hasUsername = typeof currentUser !== 'undefined' && currentUser && currentUser.username;

    body.innerHTML =
        '<div id="globalChatMessages" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:10px 14px;display:flex;flex-direction:column;gap:6px;">' +
            '<div style="text-align:center;padding:20px;color:var(--text-faint);font-size:0.75rem;">Loading chat...</div>' +
        '</div>' +
        '<div style="flex-shrink:0;padding:8px 14px;border-top:1px solid var(--border);background:var(--bg-side);">' +
            (hasUsername ?
                '<div id="chatReplyBanner" style="display:none;padding:4px 10px;background:rgba(99,102,241,0.1);border-left:3px solid #6366f1;border-radius:6px;margin-bottom:4px;font-size:0.7rem;color:var(--text-muted);position:relative;">Replying to <strong id="chatReplyName"></strong>: <span id="chatReplyPreview"></span><span onclick="cancelReply()" style="position:absolute;right:6px;top:2px;cursor:pointer;font-size:0.85rem;color:var(--text-faint);">✕</span></div>' +
                '<div style="position:relative;">' +
                    '<div id="chatAutocomplete" style="display:none;position:absolute;bottom:100%;left:0;right:0;max-height:150px;overflow-y:auto;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;margin-bottom:4px;box-shadow:0 -4px 16px rgba(0,0,0,0.3);z-index:10;"></div>' +
                    '<div style="display:flex;gap:6px;align-items:center;">' +
                        '<input type="text" id="globalChatInput" placeholder="Say something..." maxlength="' + MAX_MSG_LENGTH + '" style="flex:1;padding:10px 14px;background:var(--input-bg);border:1px solid var(--border);border-radius:20px;color:var(--text);font-size:0.85rem;font-family:inherit;outline:none;box-sizing:border-box;" autocomplete="off">' +
                        '<button onclick="sendGlobalChat()" style="padding:8px 14px;background:var(--accent);color:#fff;border:none;border-radius:20px;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;flex-shrink:0;">Send</button>' +
                    '</div>' +
                '</div>'
            :
                '<div style="text-align:center;padding:6px;color:var(--text-muted);font-size:0.75rem;">' +
                    (isSignedIn ? 'Set a username in Settings to chat' : 'Sign in to chat') +
                '</div>'
            ) +
        '</div>';

    // Wire up input handlers
    var input = document.getElementById('globalChatInput');
    if (input) {
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

// Keep overlay button visible on ALL pages except full chat hub view
var _origRenderChatHub = window.renderChatHub;
window.renderChatHub = function(tab) {
    var btn = document.getElementById('chatOverlayBtn');
    if (btn) btn.style.display = 'none';
    if (_overlayOpen) {
        _overlayOpen = false;
        var panel = document.getElementById('chatOverlay');
        if (panel) panel.style.transform = 'translateY(100%)';
        if (btn) { btn.innerHTML = '💬'; btn.style.background = 'var(--accent,#f7931a)'; btn.style.color = '#fff'; }
    }
    return _origRenderChatHub(tab);
};

// Re-show overlay button on ANY navigation (go, goHome, popstate)
function showOverlayBtn() {
    var btn = document.getElementById('chatOverlayBtn');
    if (btn) btn.style.display = 'block';
}

var _origGoHome2 = window.goHome;
if (_origGoHome2) {
    window.goHome = function() {
        showOverlayBtn();
        return _origGoHome2.apply(this, arguments);
    };
}

var _origGo2 = window.go;
if (_origGo2) {
    window.go = function(id) {
        // Show button on all pages except full chat hub
        if (id !== 'chat') showOverlayBtn();
        return _origGo2.apply(this, arguments);
    };
}

window.addEventListener('popstate', showOverlayBtn);

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
        if (data && data.active && data.djUid !== uid) {
            // Someone else is DJing — join the queue
            djJoinQueue(uid, username);
        } else {
            // Booth is open (or we're already the DJ) — go live
            djGoLive(uid, username, track);
        }
    }).catch(function() {
        // If doc doesn't exist, booth is open
        djGoLive(uid, username, track);
    });
};

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
        if (window._beatsQueueIdx !== lastTrackIdx) {
            lastTrackIdx = window._beatsQueueIdx;
            _djSongCount++;
            var t = window._beatsQueue[lastTrackIdx];
            if (t) {
                db.collection('global_chat_meta').doc(DJ_DOC).update({
                    trackTitle: t.title || 'Untitled',
                    trackArtist: t.artist || t.authorName || 'Unknown',
                    trackCoverArt: t.coverArt || '',
                    trackAudioUrl: t.audioUrl || '',
                    trackId: t.id || '',
                    artistUid: t.authorId || '',
                    songCount: _djSongCount
                }).catch(function() {});
            }
            // Check 5-song limit if queue has people waiting
            checkDJSongLimit();
        }
    }, 2000);
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
};

// Listeners: tune in to the DJ's stream
window.djTuneIn = function() {
    var npEl = document.getElementById('djNowPlaying');
    if (!npEl) return;
    var url = npEl.getAttribute('data-audio-url');
    if (!url) { if (typeof showToast === 'function') showToast('No audio available for this track'); return; }
    if (window._beatsAudio && !window._beatsAudio.paused) {
        window._beatsAudio.pause();
        if (typeof showToast === 'function') showToast('⏸ Your player paused — listening to DJ');
    }
    if (_djAudio) { _djAudio.pause(); _djAudio = null; }
    _djAudio = new Audio(url);
    _djAudio.volume = 0.8;
    _djAudio.play().catch(function(e) {
        if (typeof showToast === 'function') showToast('Playback failed: ' + e.message);
    });
    _djListening = true;
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
                    _djAudio.pause();
                    _djAudio = new Audio(d.trackAudioUrl);
                    _djAudio.volume = 0.8;
                    _djAudio.play().catch(function() {});
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
        bar.style.cssText = 'position:sticky;top:0;z-index:5;background:linear-gradient(135deg,rgba(99,102,241,0.15),rgba(247,147,26,0.1));border:1px solid rgba(99,102,241,0.3);border-radius:12px;padding:10px 14px;margin-bottom:8px;';
        container.insertBefore(bar, container.firstChild);
    }
    var myUid = auth && auth.currentUser ? auth.currentUser.uid : null;
    var isDJ = d.djUid === myUid;
    var songInfo = d.songCount ? ' · Song ' + d.songCount + (d.songCount >= DJ_MAX_SONGS_WITH_QUEUE ? '/5' : '') : '';

    bar.setAttribute('data-audio-url', d.trackAudioUrl || '');
    bar.innerHTML =
        '<div style="display:flex;align-items:center;gap:10px;">' +
            (d.trackCoverArt ? '<img src="' + esc(d.trackCoverArt) + '" style="width:44px;height:44px;border-radius:8px;object-fit:cover;flex-shrink:0;">' : '<div style="width:44px;height:44px;border-radius:8px;background:rgba(99,102,241,0.2);display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;">🎧</div>') +
            '<div style="flex:1;min-width:0;">' +
                '<div style="font-size:0.7rem;color:#6366f1;font-weight:700;margin-bottom:2px;">🎧 @' + esc(d.djName) + ' is DJing!' + songInfo + ' <span id="djQueueInfo" style="color:var(--text-faint);font-weight:400;"></span></div>' +
                '<div style="font-size:0.85rem;color:var(--heading,#fff);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">♫ ' + esc(d.trackTitle) + '</div>' +
                '<div style="font-size:0.72rem;color:var(--text-muted);cursor:pointer;" onclick="if(\'' + (d.artistUid||'') + '\'&&typeof showUserProfile===\'function\')showUserProfile(\'' + (d.artistUid||'') + '\')">' + esc(d.trackArtist) +
                    (d.artistUid ? ' <span style="color:var(--accent);font-weight:700;">⚡ Tip</span>' : '') +
                '</div>' +
            '</div>' +
            '<div style="flex-shrink:0;display:flex;flex-direction:column;gap:4px;align-items:center;">' +
                (isDJ ?
                    '<button onclick="djStopBroadcast()" style="padding:6px 10px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;color:#ef4444;font-size:0.7rem;font-weight:700;cursor:pointer;border:none;font-family:inherit;">⏹ Stop DJ</button>' :
                    '<button id="djTuneBtn" onclick="djTuneIn()" style="padding:6px 10px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);border-radius:8px;color:#6366f1;font-size:0.7rem;font-weight:700;cursor:pointer;font-family:inherit;">' + (_djListening ? '⏹ Stop' : '🔊 Tune In') + '</button>'
                ) +
                (d.djUid && !isDJ ? '<button onclick="if(typeof showUserProfile===\'function\')showUserProfile(\'' + (d.djUid||'') + '\')" style="padding:4px 8px;background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.3);border-radius:8px;color:var(--accent);font-size:0.65rem;font-weight:700;cursor:pointer;font-family:inherit;">⚡ Tip DJ</button>' : '') +
                (_djQueuePosition > 0 ? '<button onclick="djLeaveQueue()" style="padding:4px 8px;background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.2);border-radius:8px;color:#ef4444;font-size:0.6rem;cursor:pointer;font-family:inherit;">Leave Queue (#' + _djQueuePosition + ')</button>' : '') +
            '</div>' +
        '</div>';
}

function hideDJBar() {
    var bar = document.getElementById('djNowPlaying');
    if (bar) bar.remove();
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

// Init overlay on load + hide old desktop DM button
function initOverlay() {
    createChatOverlay();
    var oldBtn = document.getElementById('desktopDMBtn');
    if (oldBtn) oldBtn.style.display = 'none';
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(initOverlay, 2000); });
} else {
    setTimeout(initOverlay, 2000);
}

console.log('[CHAT] Global chat module loaded');
}();
